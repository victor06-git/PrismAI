"use client";

import { useCallback, useRef, useState } from "react";
import {
  demoCreativeConcepts,
  demoInsights,
  demoKpiInsights,
  demoTickets,
  demoTranscript,
  demoTimeline,
  teamMembers,
} from "@/data/mockData";
import type {
  AiInsight,
  CreativeConcept,
  KpiInsight,
  MeetingPhase,
  Ticket,
  ToastMessage,
  TranscriptLine,
} from "@/types";

interface MeetingDemoState {
  phase: MeetingPhase;
  transcript: TranscriptLine[];
  insights: AiInsight[];
  tickets: Ticket[];
  concepts: CreativeConcept[];
  kpiInsights: KpiInsight[];
  toasts: ToastMessage[];
  elapsedSeconds: number;
  isListening: boolean;
}

export function useMeetingDemo() {
  const [state, setState] = useState<MeetingDemoState>({
    phase: "idle",
    transcript: [],
    insights: [],
    tickets: [],
    concepts: [],
    kpiInsights: [],
    toasts: [],
    elapsedSeconds: 0,
    isListening: false,
  });

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addToast = useCallback(
    (title: string, description?: string, type: ToastMessage["type"] = "info") => {
      const toast: ToastMessage = {
        id: `toast-${Date.now()}-${Math.random()}`,
        title,
        description,
        type,
      };
      setState((prev) => ({
        ...prev,
        toasts: [...prev.toasts, toast],
      }));
      const timer = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          toasts: prev.toasts.filter((t) => t.id !== toast.id),
        }));
      }, 4000);
      timersRef.current.push(timer);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      toasts: prev.toasts.filter((t) => t.id !== id),
    }));
  }, []);

  const clearAll = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearAll();
    setState({
      phase: "idle",
      transcript: [],
      insights: [],
      tickets: [],
      concepts: [],
      kpiInsights: [],
      toasts: [],
      elapsedSeconds: 0,
      isListening: false,
    });
  }, [clearAll]);

  const startMeeting = useCallback(() => {
    clearAll();
    setState({
      phase: "listening",
      transcript: [],
      insights: [],
      tickets: [],
      concepts: [],
      kpiInsights: [],
      toasts: [],
      elapsedSeconds: 0,
      isListening: true,
    });

    addToast("Meeting started", "AI is listening and transcribing...", "info");

    intervalRef.current = setInterval(() => {
      setState((prev) => ({
        ...prev,
        elapsedSeconds: prev.elapsedSeconds + 1,
      }));
    }, 1000);

    demoTranscript.forEach((line, index) => {
      const timer = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          transcript: [...prev.transcript, line],
        }));

        if (index === 0) {
          addToast("Transcription active", "Live transcript streaming", "success");
        }
      }, demoTimeline.transcriptDelay * (index + 1));
      timersRef.current.push(timer);
    });

    demoInsights.forEach((insight, index) => {
      const timer = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          insights: [...prev.insights, insight],
        }));

        if (index === 0) {
          addToast("AI analysis started", "Identifying tasks and decisions", "info");
        }
      }, demoTimeline.insightDelay * (index + 1));
      timersRef.current.push(timer);
    });

    demoTickets.forEach((ticket, index) => {
      const timer = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          tickets: [...prev.tickets, ticket],
        }));

        if (index === 0) {
          addToast("Ticket created", `${ticket.key}: ${ticket.summary}`, "success");
        } else if (index === demoTickets.length - 1) {
          addToast(
            "All tickets generated",
            `${demoTickets.length} Jira tickets ready for sprint`,
            "success",
          );
        }
      }, demoTimeline.ticketDelay * (index + 1));
      timersRef.current.push(timer);
    });

    demoCreativeConcepts.forEach((concept, index) => {
      const timer = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          concepts: [...prev.concepts, concept],
        }));

        if (index === 0) {
          addToast("Visual concepts generating", "Moodboard from conversation", "info");
        }
      }, demoTimeline.creativeDelay * (index + 1));
      timersRef.current.push(timer);
    });

    demoKpiInsights.forEach((kpi, index) => {
      const timer = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          kpiInsights: [...prev.kpiInsights, kpi],
        }));

        if (index === 0) {
          addToast("KPI insights detected", "Data questions from Cala", "info");
        }
      }, demoTimeline.kpiDelay * (index + 1));
      timersRef.current.push(timer);
    });
  }, [addToast, clearAll]);

  const stopMeeting = useCallback(() => {
    clearAll();
    setState((prev) => ({
      ...prev,
      phase: "review",
      isListening: false,
    }));
    addToast(
      "Meeting ended",
      "Review generated deliverables below",
      "success",
    );
  }, [addToast, clearAll]);

  const formatElapsed = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, []);

  return {
    ...state,
    teamMembers,
    startMeeting,
    stopMeeting,
    reset,
    dismissToast,
    formatElapsed,
  };
}
