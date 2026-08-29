"use client";

import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { MeetingPanel } from "@/components/meeting/MeetingPanel";
import { TranscriptPanel } from "@/components/meeting/TranscriptPanel";
import { ContextPanel } from "@/components/intelligence/ContextPanel";
import { SprintPanel } from "@/components/tickets/SprintPanel";
import { MoodboardPanel } from "@/components/creative/MoodboardPanel";
import { KpiPanel } from "@/components/intelligence/KpiPanel";
import { demoSprints } from "@/data/mockData";
import { useLiveMeeting } from "@/hooks/useLiveMeeting";

export default function MeetingsPage() {
  const meeting = useLiveMeeting();
  const isActive = meeting.phase === "listening" || meeting.phase === "processing";

  return (
    <AppShell toasts={meeting.toasts} onDismissToast={meeting.dismissToast}>
      <TopBar
        title="Meetings"
        subtitle="Record a real meeting — Whisper transcribes it, then OpenAI, Fal.ai and Cala turn it into tickets, moodboards and KPI insights."
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <MeetingPanel
          phase={meeting.phase}
          isListening={meeting.isListening}
          elapsed={meeting.formatElapsed(meeting.elapsedSeconds)}
          participants={meeting.teamMembers}
          onStart={meeting.startMeeting}
          onStop={meeting.stopMeeting}
          onReset={meeting.reset}
          transcriptCount={meeting.transcript.length}
          ticketCount={meeting.tickets.length}
          insightCount={meeting.kpiInsights.length}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:h-[440px]">
          <TranscriptPanel lines={meeting.transcript} isActive={isActive} />
          <ContextPanel insights={meeting.insights} isActive={isActive} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SprintPanel sprints={demoSprints} tickets={meeting.tickets} isActive={isActive} />
          <MoodboardPanel concepts={meeting.concepts} isActive={isActive} />
        </div>

        <KpiPanel insights={meeting.kpiInsights} isActive={isActive} />
      </div>
    </AppShell>
  );
}
