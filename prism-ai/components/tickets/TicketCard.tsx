"use client";

import {
  Bug,
  CheckSquare,
  Layers,
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ticket, TicketStatus, TicketType } from "@/types";
import { PriorityBadge } from "./PriorityBadge";
import { AssigneeAvatar } from "./AssigneeAvatar";

interface TicketCardProps {
  ticket: Ticket;
  compact?: boolean;
  animate?: boolean;
  onClick?: () => void;
}

const typeIcons: Record<TicketType, typeof CheckSquare> = {
  story: CheckSquare,
  task: Zap,
  bug: Bug,
  epic: Layers,
};

const typeColors: Record<TicketType, string> = {
  story: "text-blue-500",
  task: "text-emerald-500",
  bug: "text-red-500",
  epic: "text-purple-500",
};

const statusConfig: Record<
  TicketStatus,
  { label: string; className: string }
> = {
  todo: { label: "To Do", className: "bg-gray-100 text-gray-600" },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-50 text-blue-700",
  },
  blocked: { label: "Blocked", className: "bg-red-50 text-red-700" },
  done: { label: "Done", className: "bg-emerald-50 text-emerald-700" },
};

export function TicketCard({
  ticket,
  compact = false,
  animate = false,
  onClick,
}: TicketCardProps) {
  const TypeIcon = typeIcons[ticket.type];
  const status = statusConfig[ticket.status];

  return (
    <div
      onClick={onClick}
      className={cn(
        "group rounded-xl border border-gray-200 bg-white transition-all hover:border-gray-300 hover:shadow-sm",
        compact ? "p-3" : "p-4",
        animate && "animate-slide-in-up",
        onClick && "cursor-pointer",
      )}
    >
      <div className="flex items-start gap-3">
        <TypeIcon
          className={cn("h-4 w-4 shrink-0 mt-0.5", typeColors[ticket.type])}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-400">{ticket.key}</span>
            <PriorityBadge priority={ticket.priority} />
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded",
                status.className,
              )}
            >
              {status.label}
            </span>
          </div>
          <p
            className={cn(
              "font-medium text-gray-900 group-hover:text-blue-600 transition-colors",
              compact ? "text-sm" : "text-sm",
            )}
          >
            {ticket.summary}
          </p>
          {!compact && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {ticket.description}
            </p>
          )}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <AssigneeAvatar member={ticket.assignee} size="sm" showName />
              {ticket.storyPoints && (
                <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                  {ticket.storyPoints} SP
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {ticket.labels.slice(0, 2).map((label) => (
                <span
                  key={label}
                  className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100"
                >
                  {label}
                </span>
              ))}
              {onClick && (
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TicketListHeader() {
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-gray-400 border-b border-gray-100">
      <span className="w-6" />
      <span>Summary</span>
      <span className="w-24 text-center">Status</span>
      <span className="w-28">Assignee</span>
      <span className="w-20">Priority</span>
    </div>
  );
}

export function TicketRow({
  ticket,
  animate = false,
}: {
  ticket: Ticket;
  animate?: boolean;
}) {
  const TypeIcon = typeIcons[ticket.type];
  const status = statusConfig[ticket.status];

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50/80 transition-colors",
        animate && "animate-slide-in-up",
      )}
    >
      <TypeIcon className={cn("h-4 w-4", typeColors[ticket.type])} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400 shrink-0">
            {ticket.key}
          </span>
          <span className="text-sm text-gray-900 truncate">{ticket.summary}</span>
        </div>
      </div>
      <span
        className={cn(
          "w-24 text-center text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded",
          status.className,
        )}
      >
        {status.label}
      </span>
      <div className="w-28">
        <AssigneeAvatar member={ticket.assignee} size="sm" showName />
      </div>
      <div className="w-20">
        <PriorityBadge priority={ticket.priority} />
      </div>
    </div>
  );
}
