"use client";

/**
 * Real counterpart to hooks/useMeetingDemo.ts — same public shape (phase,
 * transcript, tickets, concepts, kpiInsights, toasts, startMeeting/stopMeeting/
 * reset/dismissToast/formatElapsed) so MeetingPanel/TranscriptPanel/SprintPanel/
 * MoodboardPanel/KpiPanel/ContextPanel plug in unchanged — but every value
 * streams in live from the WebSocket /ws/live pipeline (Whisper -> OpenAI ->
 * Fal.ai + Cala) as the meeting happens, appended progressively rather than
 * arriving in one batch at the end.
 */

import { useCallback, useRef, useState } from "react";
import { teamMembers } from "@/data/mockData";
import type {
  AiInsight,
  CreativeConcept,
  KpiInsight,
  MeetingPhase,
  Ticket,
  ToastMessage,
  TranscriptLine,
} from "@/types";
import type { LiveServerEvent } from "@/lib/backendTypes";
import { adaptContextInsightFromTicket, adaptCreativeConcept, adaptKpiInsight, adaptTicket, adaptTranscriptLine } from "@/lib/adapters";
import { useLiveAudioStream, type LiveStreamStatus } from "./useLiveAudioStream";

interface LiveMeetingState {
  phase: MeetingPhase;
  transcript: TranscriptLine[];
  insights: AiInsight[];
  tickets: Ticket[];
  concepts: CreativeConcept[];
  kpiInsights: KpiInsight[];
  toasts: ToastMessage[];
}

const EMPTY_STATE: LiveMeetingState = {
  phase: "idle",
  transcript: [],
  insights: [],
  tickets: [],
  concepts: [],
  kpiInsights: [],
  toasts: [],
};

// Each live segment is a fixed ~4s slice (see useLiveAudioStream) — used to
// give transcript lines an approximate, honestly-labelled timestamp, since
// the backend only knows "this was segment N", not real wall-clock offsets.
const SEGMENT_SECONDS = 4;

function phaseForStatus(streamStatus: LiveStreamStatus): MeetingPhase {
  if (streamStatus === "streaming" || streamStatus === "paused" || streamStatus === "connecting") return "listening";
  return "review";
}

export function useLiveMeeting() {
  const [state, setState] = useState<LiveMeetingState>(EMPTY_STATE);
  const meetingIdRef = useRef<string | null>(null);
  const toastIdRef = useRef(0);

  const addToast = useCallback(
    (title: string, description?: string, type: ToastMessage["type"] = "info") => {
      toastIdRef.current += 1;
      const toast: ToastMessage = { id: `toast-${toastIdRef.current}`, title, description, type };
      setState((prev) => ({ ...prev, toasts: [...prev.toasts, toast] }));
      setTimeout(() => {
        setState((prev) => ({ ...prev, toasts: prev.toasts.filter((t) => t.id !== toast.id) }));
      }, 4000);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setState((prev) => ({ ...prev, toasts: prev.toasts.filter((t) => t.id !== id) }));
  }, []);

  const handleLiveEvent = useCallback((event: LiveServerEvent) => {
    switch (event.type) {
      case "TRANSCRIPT_UPDATE": {
        const line = adaptTranscriptLine({
          index: event.segmentIndex,
          start: (event.segmentIndex - 1) * SEGMENT_SECONDS,
          end: event.segmentIndex * SEGMENT_SECONDS,
          text: event.text,
        });
        setState((prev) => ({ ...prev, transcript: [...prev.transcript, line] }));
        break;
      }
      case "NEW_TICKET": {
        setState((prev) => ({
          ...prev,
          tickets: [...prev.tickets, adaptTicket(event.ticket, prev.tickets.length)],
          insights: [...prev.insights, adaptContextInsightFromTicket(event.ticket)],
        }));
        break;
      }
      case "MOODBOARD_IMAGE": {
        setState((prev) => ({
          ...prev,
          concepts: [
            ...prev.concepts,
            adaptCreativeConcept(
              { assetName: event.assetName, falPrompt: event.falPrompt, imageUrl: event.imageUrl },
              prev.concepts.length,
            ),
          ],
        }));
        break;
      }
      case "CALA_METRIC": {
        setState((prev) => ({ ...prev, kpiInsights: [...prev.kpiInsights, adaptKpiInsight(event.insight)] }));
        break;
      }
      case "ERROR": {
        addToast("Live pipeline issue", event.message, "warning");
        break;
      }
      case "STATUS":
        break; // "ready"/"analyzing" narration — no UI action needed beyond the stream's own status
    }
  }, [addToast]);

  const handleStreamError = useCallback(
    (message: string) => {
      addToast("Could not start live session", message, "error");
      setState((prev) => ({ ...prev, phase: "idle" }));
    },
    [addToast],
  );

  const stream = useLiveAudioStream(handleLiveEvent, handleStreamError);

  const startMeeting = useCallback(() => {
    meetingIdRef.current = crypto.randomUUID();
    setState({ ...EMPTY_STATE, phase: "listening" });
    addToast("Meeting started", "Streaming your microphone live…", "info");
    void stream.start(meetingIdRef.current);
  }, [stream, addToast]);

  const stopMeeting = useCallback(() => {
    stream.stop();
    setState((prev) => ({ ...prev, phase: "review" }));
    addToast("Meeting ended", "Review generated deliverables below.", "success");
  }, [stream, addToast]);

  const reset = useCallback(() => {
    stream.reset();
    meetingIdRef.current = null;
    setState(EMPTY_STATE);
  }, [stream]);

  const formatElapsed = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, []);

  return {
    ...state,
    // Once a meeting is running, let the stream's own connection status
    // drive the phase (covers "paused" without a dedicated toggle here);
    // once stopped, stay in "review" (set explicitly by stopMeeting/reset).
    phase: state.phase === "idle" ? "idle" : state.phase === "review" ? "review" : phaseForStatus(stream.status),
    teamMembers,
    elapsedSeconds: stream.elapsedSeconds,
    isListening: stream.status === "streaming",
    isPaused: stream.status === "paused",
    audioLevel: stream.audioLevel,
    togglePause: stream.togglePause,
    startMeeting,
    stopMeeting,
    reset,
    dismissToast,
    formatElapsed,
  };
}
