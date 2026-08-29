"""
Pure unit tests for LiveMeetingSession's transcript-overlap dedup and
cross-round insight-id stamping — no API keys needed, these never touch
OpenAI/Fal.ai/Cala.
"""

from audio.live_session import LiveMeetingSession, _dedupe_segment_overlap
from schemas import CalaDataInsight


def _insight(**overrides) -> CalaDataInsight:
    base = dict(
        id="INS-1",
        question="How big is the thing?",
        metricTarget="Size",
        value="42",
        trend="flat",
        summary="It's 42.",
        comparison="About the size of a breadbox.",
        magnitude="notable",
        source="ai",
    )
    base.update(overrides)
    return CalaDataInsight(**base)


# ---------------------------------------------------------------------------
# _dedupe_segment_overlap
# ---------------------------------------------------------------------------


def test_dedupe_segment_overlap_trims_repeated_trailing_words():
    previous = "we need to finalize the push notification system"
    new = "push notification system before launch"
    assert _dedupe_segment_overlap(previous, new) == "before launch"


def test_dedupe_segment_overlap_ignores_punctuation_and_case():
    previous = "let's ship the onboarding flow."
    new = "Onboarding Flow, then we can move on"
    assert _dedupe_segment_overlap(previous, new) == "then we can move on"


def test_dedupe_segment_overlap_no_overlap_returns_new_unchanged():
    previous = "marketing needs the app store assets"
    new = "by next Friday for the launch"
    assert _dedupe_segment_overlap(previous, new) == "by next Friday for the launch"


def test_dedupe_segment_overlap_empty_previous_returns_new_unchanged():
    assert _dedupe_segment_overlap("", "hello there") == "hello there"


def test_dedupe_segment_overlap_full_duplicate_returns_empty():
    previous = "what is our current retention rate"
    new = "current retention rate"
    assert _dedupe_segment_overlap(previous, new) == ""


# ---------------------------------------------------------------------------
# LiveMeetingSession.record_chunk_text — uses the dedup above end-to-end
# ---------------------------------------------------------------------------


def test_record_chunk_text_appends_trimmed_text_and_returns_it():
    session = LiveMeetingSession(meeting_id="m1")
    first = session.record_chunk_text("we need to finalize the push notification system")
    second = session.record_chunk_text("push notification system before launch")

    assert first == "we need to finalize the push notification system"
    assert second == "before launch"
    assert session.cumulative_text == "we need to finalize the push notification system before launch"


def test_record_chunk_text_ignores_blank_segment():
    session = LiveMeetingSession(meeting_id="m1")
    session.record_chunk_text("hello")
    result = session.record_chunk_text("   ")
    assert result == ""
    assert session.cumulative_text == "hello"


# ---------------------------------------------------------------------------
# LiveMeetingSession.dedupe_insights — cross-round id collisions
# ---------------------------------------------------------------------------


def test_dedupe_insights_restamps_ids_uniquely_across_rounds():
    session = LiveMeetingSession(meeting_id="m1")

    round_one = session.dedupe_insights([_insight(id="INS-1", question="Q1")])
    round_two = session.dedupe_insights([_insight(id="INS-1", question="Q2")])  # model restarts its own numbering

    assert [i.id for i in round_one] == ["INS-1"]
    assert [i.id for i in round_two] == ["INS-2"]  # never collides with round one


def test_dedupe_insights_filters_already_seen_questions():
    session = LiveMeetingSession(meeting_id="m1")
    session.dedupe_insights([_insight(question="Same question")])
    fresh = session.dedupe_insights([_insight(question="Same question")])
    assert fresh == []


def test_dedupe_insights_prefixes_cala_source_distinctly():
    session = LiveMeetingSession(meeting_id="m1")
    fresh = session.dedupe_insights([_insight(id="CALA-1", source="cala", question="Cala fact")])
    assert fresh[0].id == "CALA-1"
