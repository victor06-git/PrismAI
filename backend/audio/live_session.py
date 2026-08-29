"""
audio/live_session.py

WebSocket /ws/live — progressive, event-driven speech-to-workflow pipeline.

Protocol (JSON text frames unless noted):
  Client -> Server:
    {"type": "init", "meetingId"?: "..."}   — sent once, right after connecting
    <binary frame>                           — one audio segment (see chunking note below)
    {"type": "stop"}                          — optional; closing the socket works too

  Server -> Client:
    {"type": "STATUS", "stage": "..."}
    {"type": "TRANSCRIPT_UPDATE", "text", "cumulativeText", "segmentIndex"}
    {"type": "NEW_TICKET", "ticket": {...Ticket...}}
    {"type": "MOODBOARD_IMAGE", "assetName", "falPrompt", "imageUrl"}
    {"type": "CALA_METRIC", "insight": {...CalaDataInsight...}}
    {"type": "ERROR", "message": "..."}

Chunking note (read before changing the client): each binary frame must be
an independently-decodable audio file, not an arbitrary slice of one. A
MediaRecorder's `ondataavailable` chunks are only self-contained for the
very first chunk — later ones are raw continuation data with no container
header, so Whisper can't read them standalone. The client is expected to
stop() and immediately restart() its MediaRecorder every ~4s, sending each
resulting (small, valid) file as one frame. The unavoidable cost of that
approach: a word spoken exactly across a restart boundary can be split or
partially lost. Getting that to zero requires OpenAI's separate Realtime
API (a materially different integration) — this module does not claim to
solve it, only to keep the loss confined to segment boundaries instead of
losing whole sentences.

Progressive extraction: re-running GPT structured extraction on every single
~4s chunk would be slow and expensive, so it only re-runs every
EXTRACTION_EVERY_N_CHUNKS chunks (and only if the transcript actually grew).
Tickets/visual prompts/insights already seen (by title / assetName /
question) are deduped so the client only ever receives genuinely new ones.
"""

import asyncio
import json
import time
from dataclasses import dataclass, field
from uuid import uuid4

from fastapi import WebSocket, WebSocketDisconnect

from database import save_asset, save_context, save_meeting
from schemas import CalaDataInsight, Ticket, VisualAssetPrompt
from services.cala_service import fetch_data_insights_typed
from services.clients import MissingAPIKeyError, UpstreamServiceError, logger
from services.fal_service import generate_visual_asset
from services.openai_service import generate_meeting_outputs_incremental
from services.whisper_service import transcribe_audio

# --- Hardening knobs ---------------------------------------------------
MAX_CHUNK_BYTES = 2 * 1024 * 1024  # ~4s of compressed webm/opus is normally <200KB
MIN_CHUNK_INTERVAL_SECONDS = 1.0  # a real client can't legitimately send faster than this
MAX_CONCURRENT_SESSIONS = 20

# --- Progressive-extraction pacing --------------------------------------
EXTRACTION_EVERY_N_CHUNKS = 2
CALA_EVERY_N_CHUNKS = 4
MIN_TRANSCRIPT_GROWTH_CHARS = 20  # skip re-extraction if barely anything new was said

_active_sessions = 0
_active_sessions_lock = asyncio.Lock()


@dataclass
class LiveMeetingSession:
    meeting_id: str
    cumulative_text: str = ""
    chunk_count: int = 0
    text_at_last_extraction: str = ""
    is_extracting: bool = False
    is_querying_cala: bool = False
    seen_ticket_titles: set[str] = field(default_factory=set)
    seen_asset_names: set[str] = field(default_factory=set)
    seen_insight_questions: set[str] = field(default_factory=set)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def record_chunk_text(self, text: str) -> None:
        self.chunk_count += 1
        text = text.strip()
        if text:
            self.cumulative_text = f"{self.cumulative_text} {text}".strip()

    def should_extract(self) -> bool:
        if self.is_extracting or self.chunk_count == 0:
            return False
        if self.chunk_count % EXTRACTION_EVERY_N_CHUNKS != 0:
            return False
        return len(self.cumulative_text) - len(self.text_at_last_extraction) >= MIN_TRANSCRIPT_GROWTH_CHARS

    def should_query_cala(self) -> bool:
        if self.is_querying_cala or self.chunk_count == 0:
            return False
        return self.chunk_count % CALA_EVERY_N_CHUNKS == 0

    def dedupe_tickets(self, tickets: list[Ticket]) -> list[Ticket]:
        fresh = [t for t in tickets if t.title not in self.seen_ticket_titles]
        self.seen_ticket_titles.update(t.title for t in fresh)
        return fresh

    def dedupe_assets(self, assets: list[VisualAssetPrompt]) -> list[VisualAssetPrompt]:
        fresh = [a for a in assets if a.assetName not in self.seen_asset_names]
        self.seen_asset_names.update(a.assetName for a in fresh)
        return fresh

    def dedupe_insights(self, insights: list[CalaDataInsight]) -> list[CalaDataInsight]:
        fresh = [i for i in insights if i.question not in self.seen_insight_questions]
        self.seen_insight_questions.update(i.question for i in fresh)
        return fresh


async def websocket_live_session(websocket: WebSocket) -> None:
    global _active_sessions

    async with _active_sessions_lock:
        if _active_sessions >= MAX_CONCURRENT_SESSIONS:
            await websocket.close(code=1013, reason="Server is at capacity — too many live sessions.")
            return
        _active_sessions += 1

    await websocket.accept()
    session: LiveMeetingSession | None = None
    last_chunk_at = 0.0

    async def send_event(event_type: str, **data) -> None:
        try:
            await websocket.send_json({"type": event_type, **data})
        except Exception:
            pass  # client already disconnected (possibly mid background task) — nothing to do

    try:
        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.disconnect":
                break

            text_payload = message.get("text")
            if text_payload is not None:
                try:
                    payload = json.loads(text_payload)
                except json.JSONDecodeError:
                    await send_event("ERROR", message="Malformed control message (expected JSON).")
                    continue

                msg_type = payload.get("type")
                if msg_type == "init":
                    meeting_id = str(payload.get("meetingId") or uuid4())
                    session = LiveMeetingSession(meeting_id=meeting_id)
                    save_meeting(meeting_id, "")
                    logger.info("live-session %s: started.", meeting_id)
                    await send_event("STATUS", stage="ready", meetingId=meeting_id)
                elif msg_type == "stop":
                    break
                continue

            binary_payload = message.get("bytes")
            if binary_payload is not None:
                if session is None:
                    await send_event("ERROR", message='Send {"type":"init"} before audio chunks.')
                    continue

                if len(binary_payload) > MAX_CHUNK_BYTES:
                    await send_event(
                        "ERROR", message=f"Audio chunk exceeds the {MAX_CHUNK_BYTES // (1024 * 1024)}MB limit."
                    )
                    continue

                now = time.monotonic()
                if now - last_chunk_at < MIN_CHUNK_INTERVAL_SECONDS:
                    await send_event("ERROR", message="Chunks are arriving faster than allowed.")
                    continue
                last_chunk_at = now

                await _process_chunk(session, binary_payload, send_event)

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # never let one bad frame kill the process
        logger.error("live-session: unexpected error: %s", exc)
    finally:
        if session:
            logger.info("live-session %s: ended (%d chunks).", session.meeting_id, session.chunk_count)
        async with _active_sessions_lock:
            _active_sessions -= 1


async def _process_chunk(session: LiveMeetingSession, chunk: bytes, send_event) -> None:
    try:
        transcription = await asyncio.to_thread(transcribe_audio, chunk, f"segment-{session.chunk_count}.webm")
    except (MissingAPIKeyError, UpstreamServiceError) as exc:
        # Deliberately NOT falling back to mock text here, unlike the batch
        # endpoints — a "live" transcript silently switching to canned demo
        # words would be actively misleading, not resilient.
        logger.warning("live-session %s: chunk transcription failed: %s", session.meeting_id, exc)
        await send_event("ERROR", message=f"Transcription failed for this segment: {exc}")
        return
    except Exception as exc:
        logger.error("live-session %s: unexpected transcription error: %s", session.meeting_id, exc)
        await send_event("ERROR", message="Unexpected transcription error.")
        return

    session.record_chunk_text(transcription.text)
    if transcription.text:
        await send_event(
            "TRANSCRIPT_UPDATE",
            text=transcription.text,
            cumulativeText=session.cumulative_text,
            segmentIndex=session.chunk_count,
        )
        save_meeting(session.meeting_id, session.cumulative_text)

    if session.should_extract():
        asyncio.create_task(_run_extraction(session, send_event))

    if session.should_query_cala():
        asyncio.create_task(_run_cala(session, send_event))


async def _run_extraction(session: LiveMeetingSession, send_event) -> None:
    async with session.lock:
        if session.is_extracting:
            return
        session.is_extracting = True
        text_snapshot = session.cumulative_text
        known_titles = sorted(session.seen_ticket_titles)
        known_assets = sorted(session.seen_asset_names)

    try:
        await send_event("STATUS", stage="analyzing")
        extracted = await asyncio.to_thread(
            generate_meeting_outputs_incremental, text_snapshot, known_titles, known_assets
        )
    except Exception as exc:
        logger.warning("live-session %s: incremental extraction failed: %s", session.meeting_id, exc)
        return
    finally:
        async with session.lock:
            session.is_extracting = False
            session.text_at_last_extraction = text_snapshot

    async with session.lock:
        new_tickets = session.dedupe_tickets(extracted.tickets)
        new_assets = session.dedupe_assets(extracted.visualAssets)

    for ticket in new_tickets:
        await send_event("NEW_TICKET", ticket=ticket.model_dump())

    for asset in new_assets:
        asyncio.create_task(_generate_moodboard_image(session, asset, send_event))


async def _generate_moodboard_image(session: LiveMeetingSession, asset: VisualAssetPrompt, send_event) -> None:
    try:
        url = await asyncio.to_thread(generate_visual_asset, asset.falPrompt)
    except Exception as exc:
        logger.warning("live-session %s: moodboard image failed for %r: %s", session.meeting_id, asset.assetName, exc)
        return
    save_asset(meeting_id=session.meeting_id, prompt=asset.falPrompt, image_url=url)
    await send_event("MOODBOARD_IMAGE", assetName=asset.assetName, falPrompt=asset.falPrompt, imageUrl=url)


async def _run_cala(session: LiveMeetingSession, send_event) -> None:
    async with session.lock:
        if session.is_querying_cala:
            return
        session.is_querying_cala = True
        text_snapshot = session.cumulative_text

    try:
        insights = await asyncio.to_thread(fetch_data_insights_typed, text_snapshot)
    except Exception as exc:
        logger.info("live-session %s: Cala had nothing new to add: %s", session.meeting_id, exc)
        insights = []
    finally:
        async with session.lock:
            session.is_querying_cala = False

    async with session.lock:
        fresh = session.dedupe_insights(insights)

    for insight in fresh:
        await send_event("CALA_METRIC", insight=insight.model_dump())
        save_context(session.meeting_id, "cala_insight", json.dumps(insight.model_dump()))
