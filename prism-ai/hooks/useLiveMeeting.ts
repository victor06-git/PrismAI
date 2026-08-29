"use client";

/**
 * Real counterpart to hooks/useMeetingDemo.ts — same public shape (phase,
 * transcript, tickets, concepts, kpiInsights, toasts, startMeeting/stopMeeting/
 * reset/dismissToast/formatElapsed) so MeetingPanel/TranscriptPanel/SprintPanel/
 * MoodboardPanel/KpiPanel/ContextPanel plug in unchanged — but every value
 * comes from an actual microphone recording run through the real backend
 * pipeline (Whisper -> OpenAI -> Fal.ai + Cala), never a staged demo timer.
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
import { ApiError, transcribeAndProcess } from "@/lib/api";
import { adaptMeetingResult, adaptTranscriptLine } from "@/lib/adapters";
import { useAudioRecorder } from "./useAudioRecorder";

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

  const handleRecordingComplete = useCallback(
    async (blob: Blob, mimeType: string) => {
      const meetingId = meetingIdRef.current ?? crypto.randomUUID();
      meetingIdRef.current = meetingId;
      setState((prev) => ({ ...prev, phase: "processing" }));
      addToast("Processing recording", "Transcribing with Whisper and analyzing…", "info");

      const extension = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "ogg";

      try {
        const result = await transcribeAndProcess(blob, `recording.${extension}`, meetingId);
        const { tickets, concepts, kpiInsights, contextInsights } = adaptMeetingResult(result);
        setState((prev) => ({
          ...prev,
          phase: "review",
          transcript: result.segments.map(adaptTranscriptLine),
          insights: contextInsights,
          tickets,
          concepts,
          kpiInsights,
        }));
        addToast(
          "Meeting deliverables ready",
          `${tickets.length} tickets, ${concepts.length} visual concepts, ${kpiInsights.length} insights`,
          "success",
        );
      } catch (err) {
        setState((prev) => ({ ...prev, phase: "review" }));
        addToast(
          "Processing failed",
          err instanceof ApiError ? err.message : "Something went wrong processing the recording.",
          "error",
        );
      }
    },
    [addToast],
  );

  const handleRecorderError = useCallback(
    (message: string) => {
      addToast("Could not start recording", message, "error");
      setState((prev) => ({ ...prev, phase: "idle" }));
    },
    [addToast],
  );

  const recorder = useAudioRecorder(handleRecordingComplete, handleRecorderError);

  const startMeeting = useCallback(() => {
    meetingIdRef.current = crypto.randomUUID();
    setState({ ...EMPTY_STATE, phase: "listening" });
    addToast("Meeting started", "Recording your microphone…", "info");
    void recorder.start();
  }, [recorder, addToast]);

  const stopMeeting = useCallback(() => {
    // recorder.onstop -> handleRecordingComplete fires async and carries the
    // phase forward: listening -> processing -> review.
    recorder.stop();
  }, [recorder]);

  const reset = useCallback(() => {
    recorder.reset();
    meetingIdRef.current = null;
    setState(EMPTY_STATE);
  }, [recorder]);

  const formatElapsed = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, []);

  return {
    ...state,
    teamMembers,
    elapsedSeconds: recorder.elapsedSeconds,
    isListening: recorder.status === "recording",
    startMeeting,
    stopMeeting,
    reset,
    dismissToast,
    formatElapsed,
  };
}
