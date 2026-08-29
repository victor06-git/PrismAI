"use client";

/**
 * Kanban-style view of the intelligently-prioritized backlog — tickets are
 * already scored + sorted server-side (services/orchestrator.py). Vice
 * City / cyber-neon glass treatment; Framer Motion drives entrance +
 * hover/tap micro-interactions.
 */

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Rocket, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ticket, TicketBadge, TicketTag } from "@/types";

const BADGE_COLUMNS: {
  badge: TicketBadge;
  label: string;
  hint: string;
  icon: typeof Sparkles;
  accent: string;
  glow: string;
}[] = [
  {
    badge: "Quick Win",
    label: "Quick Wins",
    hint: "High impact, low complexity — do these first.",
    icon: Sparkles,
    accent: "text-cyan-300 border-cyan-400/40 bg-cyan-500/10",
    glow: "shadow-[0_0_30px_-12px_rgba(34,211,238,0.6)]",
  },
  {
    badge: "Strategic Initiative",
    label: "Strategic Initiatives",
    hint: "High impact, high complexity — plan these deliberately.",
    icon: Rocket,
    accent: "text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-500/10",
    glow: "shadow-[0_0_30px_-12px_rgba(232,121,249,0.6)]",
  },
  {
    badge: "Balanced",
    label: "Balanced",
    hint: "Moderate impact and complexity.",
    icon: Target,
    accent: "text-amber-300 border-amber-400/40 bg-amber-500/10",
    glow: "shadow-[0_0_30px_-12px_rgba(251,191,36,0.5)]",
  },
  {
    badge: "Re-evaluate",
    label: "Re-evaluate",
    hint: "Low impact, high complexity — reconsider scope before committing.",
    icon: AlertTriangle,
    accent: "text-rose-300 border-rose-400/40 bg-rose-500/10",
    glow: "shadow-[0_0_30px_-12px_rgba(251,113,133,0.5)]",
  },
];

const TAG_STYLES: Record<TicketTag, string> = {
  Frontend: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  Backend: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  AI: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/30",
  Design: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  Security: "bg-rose-500/15 text-rose-300 border-rose-400/30",
};

const URGENCY_DOT: Record<Ticket["priority"], string> = {
  critical: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]",
  high: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
  medium: "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]",
  low: "bg-zinc-500",
};

function TicketMiniCard({ ticket }: { ticket: Ticket }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -3, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      className="rounded-xl border border-pink-500/20 bg-black/40 p-3 backdrop-blur-xl transition-colors hover:border-pink-400/40"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] text-zinc-500">{ticket.id}</span>
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", URGENCY_DOT[ticket.priority])} title={ticket.priority} />
      </div>
      <p className="mt-1 text-sm font-semibold tracking-tight text-white">{ticket.summary}</p>
      <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{ticket.description}</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", TAG_STYLES[ticket.tag])}>
          {ticket.tag}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
          {ticket.storyPoints} SP
        </span>
        <span
          className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400"
          title="Priority score = businessImpact*0.45 + urgencyWeight*0.35 - complexityScore*0.20"
        >
          score {ticket.priorityScore.toFixed(1)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-500">
        <span>Impact {ticket.businessImpact}/10</span>
        <span>Complexity {ticket.complexityScore}/10</span>
      </div>

      {ticket.dependencies.length > 0 && (
        <p className="mt-2 text-[10px] text-amber-300/80">Blocked by: {ticket.dependencies.join(", ")}</p>
      )}
    </motion.div>
  );
}

function ColumnSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="animate-skeleton h-24 rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

export function SmartBacklog({ tickets, isActive }: { tickets: Ticket[]; isActive: boolean }) {
  const byBadge = (badge: TicketBadge) => tickets.filter((t) => t.badge === badge);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {BADGE_COLUMNS.map(({ badge, label, hint, icon: Icon, accent, glow }, columnIndex) => {
        const columnTickets = byBadge(badge);
        return (
          <motion.div
            key={badge}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: columnIndex * 0.06, type: "spring", stiffness: 260, damping: 24 }}
            className={cn("flex flex-col rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl", glow)}
          >
            <div className="border-b border-white/10 p-3">
              <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-wide", accent)}>
                <Icon className="size-3.5" />
                {label}
                <span className="ml-1 rounded-full bg-black/40 px-1.5 text-[10px]">{columnTickets.length}</span>
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500">{hint}</p>
            </div>
            <div className="flex-1 space-y-2 p-3">
              {columnTickets.length === 0 && isActive && <ColumnSkeleton />}
              {columnTickets.length === 0 && !isActive && (
                <p className="py-6 text-center text-xs text-zinc-600">No tickets yet.</p>
              )}
              <AnimatePresence initial={false}>
                {columnTickets.map((ticket) => (
                  <TicketMiniCard key={ticket.id} ticket={ticket} />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
