"use client";

import { generateVisual, getCalaInsights } from "@/lib/api";
import { useCallback, useRef, useState } from "react";
import {
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

    const creativeTimer = setTimeout(async () => {
      addToast(
        "Visual concept generating",
        "Fal is creating a concept from the live conversation",
        "info",
      );

      try {
        const liveContext = demoTranscript
          .slice(0, 4)
          .map((line) => `${line.speaker}: ${line.text}`)
          .join("\n");

        const prompt = `
    Create a polished premium visual concept based on this product meeting.

    Meeting context:
    ${liveContext}

    Create a realistic modern SaaS landing page or marketing concept.
    Professional B2B startup aesthetic.
    Clean typography, premium interface, modern visual hierarchy.
    The design must clearly reflect the product, audience and goals discussed in the meeting.
    16:9 composition.
        `.trim();

        const data = await generateVisual(prompt);

        const concept: CreativeConcept = {
          id: `fal-${Date.now()}`,
          title: "AI-generated visual direction",
          description: "Generated live from the meeting using Fal",
          tags: ["Fal", "live", "AI-generated"],
          gradient: "from-violet-50 via-purple-50 to-pink-50",
          icon: "palette",
          imageUrl: data.imageUrl,
        };

        setState((prev) => ({
          ...prev,
          concepts: [...prev.concepts, concept],
        }));

        addToast(
          "Visual concept ready",
          "Fal generated a new creative direction",
          "success",
        );
      } catch {
        addToast(
          "Visual generation failed",
          "Fal could not generate the concept",
          "error",
        );
      }
    }, 9000);

    timersRef.current.push(creativeTimer);

const calaTimer = setTimeout(async () => {
    addToast(
      "Context enrichment started",
      "Cala is enriching the meeting with structured data",
      "info",
    );

    try {
      const liveContext = demoTranscript
        .slice(0, 4)
        .map((line) => `${line.speaker}: ${line.text}`)
        .join("\n");

      const query = `
  Based on this meeting context, find relevant companies, market examples or industry context.

  Meeting:
  ${liveContext}

  Return useful company or market intelligence related to the product being discussed.
      `.trim();

      const data = await getCalaInsights(query);

      const calaInsights: KpiInsight[] = data.results
        .slice(0, 4)
        .map((item, index) => ({
          id: `cala-${Date.now()}-${index}`,
          question: item.name ?? "Market insight",
          metric: item.industry ?? "Industry context",
          trend: "neutral",
          value: item.headquarters ?? "Global",
          context: item.industry ?? "Structured intelligence from Cala",
          priority: index === 0 ? "high" : "medium",
        }));

      setState((prev) => ({
        ...prev,
        kpiInsights: calaInsights,
      }));

      addToast(
        "Context enriched",
        `${calaInsights.length} structured insights added by Cala`,
        "success",
      );
    } catch {
      addToast(
        "Context enrichment failed",
        "Cala could not retrieve structured context",
        "error",
      );
    }
  }, 7000);

  timersRef.current.push(calaTimer);


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
