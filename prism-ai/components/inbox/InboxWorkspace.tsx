"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BarChart3, ImageIcon, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { ListeningBar } from "@/components/meeting/ListeningBar";
import { LiveTranscriptRail } from "@/components/meeting/LiveTranscriptRail";
import { TasksTable } from "@/components/tickets/TasksTable";
import { useRealtimeMeeting } from "@/hooks/useRealtimeMeeting";
import type { Ticket, TicketPriority } from "@/types";

type StatusTab = "tasks" | "moodboard" | "metrics";

const statusTabs: { id: StatusTab; label: string }[] = [
  { id: "tasks", label: "Tasks" },
  { id: "moodboard", label: "Moodboard" },
  { id: "metrics", label: "Metrics" },
];

const priorityMap: Record<string, TicketPriority> = { High: "high", Medium: "medium", Low: "low" };

export function InboxWorkspace() {
  const searchParams = useSearchParams();
  const meeting = useRealtimeMeeting();
  const autoStarted = useRef(false);
  const [status, setStatus] = useState<StatusTab>("tasks");
  const [transcriptOpen, setTranscriptOpen] = useState(true);

  useEffect(() => {
    if (searchParams.get("start") === "1" && !autoStarted.current) {
      autoStarted.current = true;
      void meeting.start();
    }
  }, [searchParams, meeting]);

  const tickets = useMemo<Ticket[]>(() => (meeting.result?.tickets ?? []).map((ticket, index) => ({
    id: ticket.id || `ticket-${index}`,
    key: ticket.id || `PR-${index + 1}`,
    summary: ticket.title,
    description: ticket.acceptanceCriteria.join(" "),
    status: "todo",
    priority: priorityMap[ticket.priority] ?? "medium",
    type: "story",
    labels: [ticket.tag.toLowerCase()],
    storyPoints: ticket.storyPoints,
    createdAt: "Just now",
  })), [meeting.result]);

  const active = meeting.phase === "connecting" || meeting.phase === "listening";
  const visual = meeting.result?.visualAssets[0];

  return (
    <div className="relative flex h-screen overflow-hidden bg-prisma-canvas animate-fade-in">
      <aside className="flex w-16 shrink-0 flex-col bg-prisma-canvas px-2 pt-10">
        <Link href="/" aria-label="Main menu" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-prisma-muted transition-colors hover:bg-white/70 hover:text-prisma-text">
          <ArrowLeft className="h-4 w-4 stroke-[1.5]" />
        </Link>
      </aside>

      <div className={cn("flex min-w-0 flex-1 bg-prisma-canvas pt-10 transition-[padding,gap] duration-300", transcriptOpen ? "gap-2" : "pr-6")}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-end gap-1">
            {statusTabs.map((tab) => {
              const count = tab.id === "tasks" ? tickets.length : tab.id === "metrics" ? meeting.result?.dataInsights.length ?? 0 : visual ? 1 : 0;
              return <button key={tab.id} type="button" onClick={() => setStatus(tab.id)} className={cn("relative px-5 py-2 font-serif text-lg leading-snug tracking-tight transition-colors", status === tab.id ? "z-10 -mb-px border-t border-x border-prisma-border bg-prisma-surface text-prisma-text" : "border border-prisma-border bg-[#E4E4DE] text-prisma-muted hover:text-prisma-text")}>{tab.label}{count > 0 && <span className="ml-2 font-sans text-xs text-prisma-muted">{count}</span>}</button>;
            })}
            <div className="min-w-0 flex-1 self-stretch border-b border-prisma-border" />
          </div>

          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-x border-prisma-border bg-prisma-surface">
            {meeting.result?.summary && <div className="shrink-0 border-b border-prisma-border bg-prisma-accent-soft px-6 py-3"><p className="text-xs font-medium uppercase tracking-[0.08em] text-prisma-muted">Meeting summary</p><p className="mt-1 text-sm leading-relaxed text-prisma-text">{meeting.result.summary}</p></div>}
            {meeting.error && <div className="mx-6 mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{meeting.error}</div>}

            {status === "tasks" ? (
              tickets.length ? <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-14"><TasksTable key={tickets.map((ticket) => ticket.id).join(":")} tickets={tickets} /></div> : <EmptyState icon={Mic} title={meeting.phase === "processing" ? "Creating tasks…" : active ? "Listening for decisions" : "Ready for a meeting"} body={active ? "Tasks will appear after you finish the recording." : "Start a real microphone session to create actionable tickets."} action={!active && meeting.phase !== "processing" ? () => void meeting.start() : undefined} />
            ) : status === "moodboard" ? (
              visual?.imageUrl ? <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-8 py-8 pb-24"><figure className="w-full max-w-2xl"><img src={visual.imageUrl} alt={visual.assetName} className="aspect-video w-full rounded-md border border-prisma-border object-cover" /><figcaption className="mt-3 text-sm text-prisma-muted">{visual.assetName}</figcaption></figure></div> : <EmptyState icon={ImageIcon} title={meeting.phase === "review" && visual ? "Generating moodboard…" : "No moodboard yet"} body="One optimized Fal image will appear here without blocking the summary." loading={meeting.phase === "review" && Boolean(visual)} />
            ) : meeting.result?.dataInsights.length ? (
              <div className="grid min-h-0 flex-1 auto-rows-min gap-3 overflow-y-auto p-6 pb-24 md:grid-cols-2">{meeting.result.dataInsights.map((insight) => <article key={insight.id} className="rounded-[18px] border border-prisma-border bg-prisma-canvas p-4"><p className="text-xs font-medium uppercase tracking-[0.08em] text-prisma-muted">{insight.metricTarget}</p><p className="mt-2 text-sm font-medium text-prisma-text">{insight.question}</p><p className="mt-4 font-serif text-2xl text-prisma-text">{insight.value}</p><p className="mt-2 text-xs leading-relaxed text-prisma-muted">{insight.summary}</p></article>)}</div>
            ) : <EmptyState icon={BarChart3} title="No metrics yet" body="Only metrics grounded in the real transcript will appear here." />}

            {active && <ListeningBar listening={meeting.phase === "listening" && !meeting.paused} onTogglePause={meeting.togglePause} onComplete={() => void meeting.stop()} level={meeting.audioLevel} />}
          </main>
        </div>

        <LiveTranscriptRail open={transcriptOpen} onToggle={() => setTranscriptOpen((value) => !value)} listening={meeting.phase === "listening" && !meeting.paused} lines={meeting.lines} partial={meeting.partial} />
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action, loading = false }: { icon: typeof Mic; title: string; body: string; action?: () => void; loading?: boolean }) {
  return <div className="flex flex-1 flex-col items-center justify-center px-8 pb-24">{loading ? <img src="/prisma-logo.svg" alt="Prisma" className="mb-4 h-20 w-20" /> : <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-prisma-border bg-prisma-canvas"><Icon className="h-6 w-6 text-prisma-muted stroke-[1.5]" /></div>}<h2 className={cn("font-serif text-2xl tracking-tight text-prisma-text", loading && "animate-text-shine")}>{title}</h2><p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-prisma-muted">{body}</p>{action && <button type="button" onClick={action} className="mt-5 rounded-full bg-prisma-text px-4 py-2 text-sm text-white">Start recording</button>}</div>;
}
