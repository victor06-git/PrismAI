"use client";

import { Kanban, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SprintItem, Ticket } from "@/types";
import { TicketRow, TicketListHeader } from "@/components/tickets/TicketCard";
import { LoadingSkeletonGroup } from "@/components/ui/LoadingSkeleton";

interface SprintPanelProps {
  sprints: SprintItem[];
  tickets: Ticket[];
  isActive: boolean;
}

export function SprintPanel({ sprints, tickets, isActive }: SprintPanelProps) {
  const activeSprint = sprints[0];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Kanban className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-900">
            Generated Tickets
          </h3>
          {tickets.length > 0 && (
            <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
              {tickets.length} new
            </span>
          )}
        </div>
        {activeSprint && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="h-3.5 w-3.5" />
            {activeSprint.name}
          </div>
        )}
      </div>

      {activeSprint && tickets.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Sprint progress</span>
            <span>{activeSprint.progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${Math.min(activeSprint.progress + tickets.length * 8, 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="max-h-[400px] overflow-y-auto">
        {tickets.length === 0 && isActive && (
          <div className="p-5">
            <LoadingSkeletonGroup count={4} />
          </div>
        )}

        {tickets.length === 0 && !isActive && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Kanban className="h-8 w-8 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">
              Jira tickets will be generated from the meeting
            </p>
          </div>
        )}

        {tickets.length > 0 && (
          <>
            <TicketListHeader />
            {tickets.map((ticket, index) => (
              <TicketRow key={ticket.id} ticket={ticket} animate={index === tickets.length - 1} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
