"use client";

import { useState } from "react";
import { Bug, CheckSquare, Layers, Plus, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ticket, TicketType } from "@/types";

type BoardColumn = "pending" | "in_progress" | "done";

const columns: { id: BoardColumn; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

const typeIcons: Record<TicketType, typeof CheckSquare> = {
  story: CheckSquare,
  task: Zap,
  bug: Bug,
  epic: Layers,
};

const typeColors: Record<TicketType, string> = {
  story: "text-[#5B7A2A]",
  task: "text-prisma-accent",
  bug: "text-prisma-danger",
  epic: "text-[#7B6B9E]",
};

function TaskCard({
  ticket,
  onDragStart,
  onOpen,
}: {
  ticket: Ticket;
  onDragStart: (ticketId: string) => void;
  onOpen: (ticket: Ticket) => void;
}) {
  const TypeIcon = typeIcons[ticket.type];
  const [didDrag, setDidDrag] = useState(false);

  return (
    <article
      draggable
      onDragStart={(event) => {
        setDidDrag(true);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", ticket.id);
        onDragStart(ticket.id);
      }}
      onDragEnd={() => {
        window.setTimeout(() => setDidDrag(false), 0);
      }}
      onClick={() => {
        if (!didDrag) onOpen(ticket);
      }}
      className="cursor-pointer rounded-xl border border-prisma-border bg-white px-3 py-2 transition-colors hover:border-[#C8C8BE] active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <TypeIcon
          className={cn("h-3 w-3 shrink-0 stroke-[1.5]", typeColors[ticket.type])}
        />
        <span className="font-mono text-[10px] text-prisma-muted">{ticket.key}</span>
        {ticket.assignee && (
          <div
            className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-white"
            style={{ backgroundColor: ticket.assignee.color }}
            title={ticket.assignee.name}
          >
            {ticket.assignee.avatar}
          </div>
        )}
      </div>
      <h3 className="mt-1 line-clamp-1 text-[13px] leading-snug text-prisma-text">
        {ticket.summary}
      </h3>
    </article>
  );
}

function TaskDetailModal({
  ticket,
  onClose,
}: {
  ticket: Ticket;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close task details"
        className="absolute inset-0 bg-prisma-text/25 animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        className="relative w-full max-w-md rounded-[22px] border border-prisma-border bg-prisma-surface p-6 animate-scale-in"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-prisma-muted">{ticket.key}</p>
            <h2
              id="task-detail-title"
              className="mt-1 font-serif text-2xl leading-snug tracking-tight text-prisma-text"
            >
              {ticket.summary}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-prisma-muted transition-colors hover:bg-prisma-canvas hover:text-prisma-text"
          >
            <X className="h-4 w-4 stroke-[1.5]" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="mb-1.5 text-[11px] font-medium tracking-[0.08em] text-prisma-muted uppercase">
              Description
            </p>
            <p className="text-sm leading-relaxed text-prisma-text">
              {ticket.description}
            </p>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium tracking-[0.08em] text-prisma-muted uppercase">
              Member
            </p>
            {ticket.assignee ? (
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: ticket.assignee.color }}
                >
                  {ticket.assignee.avatar}
                </div>
                <div>
                  <p className="text-sm text-prisma-text">{ticket.assignee.name}</p>
                  <p className="text-xs text-prisma-muted">{ticket.assignee.role}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-prisma-muted">Unassigned</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TasksTable({ tickets }: { tickets: Ticket[] }) {
  const [board, setBoard] = useState<Record<BoardColumn, Ticket[]>>({
    pending: tickets,
    in_progress: [],
    done: [],
  });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<BoardColumn | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  function moveTicket(ticketId: string, target: BoardColumn) {
    setBoard((current) => {
      const source = columns.find((column) =>
        current[column.id].some((ticket) => ticket.id === ticketId),
      )?.id;
      if (!source || source === target) return current;

      const ticket = current[source].find((item) => item.id === ticketId);
      if (!ticket) return current;

      return {
        ...current,
        [source]: current[source].filter((item) => item.id !== ticketId),
        [target]: [...current[target], ticket],
      };
    });
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-1 flex-col px-6 pb-4 pt-4">
        <div className="grid h-full min-h-0 flex-1 grid-cols-1 grid-rows-1 gap-4 md:grid-cols-3">
          {columns.map((column) => {
            const columnTickets = board[column.id];

            return (
              <section
                key={column.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setOverColumn(column.id);
                }}
                onDragLeave={() => {
                  setOverColumn((current) =>
                    current === column.id ? null : current,
                  );
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const ticketId =
                    event.dataTransfer.getData("text/plain") || draggingId;
                  if (ticketId) moveTicket(ticketId, column.id);
                  setDraggingId(null);
                  setOverColumn(null);
                }}
                className={cn(
                  "flex h-full min-h-0 flex-col self-stretch rounded-[18px] bg-prisma-canvas transition-colors",
                  overColumn === column.id && "bg-prisma-accent-soft/50",
                )}
              >
                <header className="flex shrink-0 items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium text-prisma-text">
                      {column.label}
                    </h2>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-prisma-muted">
                      {columnTickets.length}
                    </span>
                  </div>
                  {column.id === "pending" && (
                    <button
                      type="button"
                      aria-label="Create task"
                      className="rounded-md p-1 text-prisma-muted transition-colors hover:bg-white hover:text-prisma-text"
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[1.5]" />
                    </button>
                  )}
                </header>

                <div className="flex min-h-0 flex-1 flex-col gap-2 px-2.5 pb-2.5">
                  {columnTickets.map((ticket) => (
                    <TaskCard
                      key={ticket.id}
                      ticket={ticket}
                      onDragStart={setDraggingId}
                      onOpen={setSelectedTicket}
                    />
                  ))}
                  {columnTickets.length === 0 && (
                    <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-prisma-border px-3">
                      <p className="text-center text-xs leading-relaxed text-prisma-muted">
                        Drop tasks here
                      </p>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {selectedTicket && (
        <TaskDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </>
  );
}
