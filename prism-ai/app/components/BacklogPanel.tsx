import { ListChecks } from "lucide-react";
import { clsx } from "clsx";
import type { Ticket, TicketPriority, TicketTag } from "../lib/types";

const TAG_STYLES: Record<TicketTag, string> = {
  Frontend: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Backend: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Design: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300",
  Infra: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  High: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  Low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400",
};

function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <li className="animate-card-in rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-zinc-400">{ticket.id}</p>
          <h3 className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">{ticket.title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          {ticket.storyPoints} SP
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", TAG_STYLES[ticket.tag])}>
          {ticket.tag}
        </span>
        <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", PRIORITY_STYLES[ticket.priority])}>
          {ticket.priority}
        </span>
      </div>

      {ticket.acceptanceCriteria.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {ticket.acceptanceCriteria.map((criterion, index) => (
            <li key={index} className="flex gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              {criterion}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function BacklogPanel({ tickets }: { tickets: Ticket[] }) {
  const totalPoints = tickets.reduce((sum, t) => sum + t.storyPoints, 0);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-violet-600 dark:text-violet-400" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Backlog</h2>
        </div>
        <span className="text-xs text-zinc-500">
          {tickets.length} tickets · {totalPoints} pts
        </span>
      </header>
      <ul className="flex-1 space-y-3 overflow-y-auto p-4">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </ul>
    </section>
  );
}
