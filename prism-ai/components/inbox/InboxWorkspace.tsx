"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Inbox,
  MessageSquare,
  Phone,
  FileText,
  AlertTriangle,
  User,
  Users,
  UserX,
  Settings,
  CheckCircle2,
  ChevronRight,
  Plus,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Channel = "messages" | "calls";
type StatusTab = "open" | "pending" | "completed";
type ViewId =
  | "all"
  | "drafts"
  | "escalations"
  | "assigned-me"
  | "assigned-others"
  | "unassigned"
  | "meetings"
  | "tickets"
  | "sprint"
  | "insights";

const statusTabs: { id: StatusTab; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
];

const primaryViews: { id: ViewId; label: string; icon: typeof Inbox }[] = [
  { id: "all", label: "All conversations", icon: Layers },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "escalations", label: "Escalations", icon: AlertTriangle },
];

const assignmentViews: { id: ViewId; label: string; icon: typeof User }[] = [
  { id: "assigned-me", label: "Assigned to me", icon: User },
  { id: "assigned-others", label: "Assigned to others", icon: Users },
  { id: "unassigned", label: "Unassigned", icon: UserX },
];

const inboxViews: { id: ViewId; label: string; color: string }[] = [
  { id: "meetings", label: "Meetings", color: "#7C9A3A" },
  { id: "tickets", label: "Tickets", color: "#D4A017" },
  { id: "sprint", label: "Sprint", color: "#7B6B9E" },
  { id: "insights", label: "Insights", color: "#C97B8A" },
];

const emptyCopy: Record<StatusTab, { title: string; body: string }> = {
  open: {
    title: "No conversations to manage",
    body: "Nothing here yet. When a meeting, transcript, or ticket arrives it will appear in real time.",
  },
  pending: {
    title: "No pending conversations",
    body: "Items waiting on a reply or review will show up in this tab.",
  },
  completed: {
    title: "No completed conversations",
    body: "Finished work from meetings and tickets will land here.",
  },
};

export function InboxWorkspace() {
  const [channel, setChannel] = useState<Channel>("messages");
  const [view, setView] = useState<ViewId>("all");
  const [status, setStatus] = useState<StatusTab>("open");

  return (
    <div className="flex h-screen overflow-hidden bg-prisma-canvas animate-fade-in">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-prisma-border bg-prisma-canvas">
        <div className="px-4 pt-5 pb-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-prisma-text"
            aria-label="Inbox home"
          >
            <Inbox className="h-4 w-4 stroke-[1.5]" />
            <span className="text-[15px] font-medium tracking-tight">Inbox</span>
          </Link>
        </div>

        <div className="px-3 pb-4">
          <div className="flex rounded-full bg-[#EFEFEA] p-1">
            <ChannelButton
              active={channel === "messages"}
              onClick={() => setChannel("messages")}
              icon={MessageSquare}
              label="Messages"
            />
            <ChannelButton
              active={channel === "calls"}
              onClick={() => setChannel("calls")}
              icon={Phone}
              label="Calls"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          <ul className="space-y-0.5">
            {primaryViews.map((item) => (
              <NavRow
                key={item.id}
                label={item.label}
                icon={item.icon}
                active={view === item.id}
                onClick={() => setView(item.id)}
              />
            ))}
          </ul>

          <p className="mb-1.5 mt-6 px-3 text-[11px] font-medium tracking-[0.08em] text-prisma-muted uppercase">
            Assignment
          </p>
          <ul className="space-y-0.5">
            {assignmentViews.map((item) => (
              <NavRow
                key={item.id}
                label={item.label}
                icon={item.icon}
                active={view === item.id}
                onClick={() => setView(item.id)}
              />
            ))}
          </ul>

          <div className="mb-1.5 mt-6 flex items-center justify-between px-3">
            <p className="text-[11px] font-medium tracking-[0.08em] text-prisma-muted uppercase">
              Inboxes
            </p>
            <button
              type="button"
              aria-label="Add inbox"
              className="rounded-md p-0.5 text-prisma-muted hover:bg-white/70 hover:text-prisma-text"
            >
              <Plus className="h-3.5 w-3.5 stroke-[1.5]" />
            </button>
          </div>
          <ul className="space-y-0.5">
            {inboxViews.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setView(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
                    view === item.id
                      ? "bg-white text-prisma-text"
                      : "text-prisma-muted hover:bg-white/70 hover:text-prisma-text",
                  )}
                >
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 stroke-[1.5]" />
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <ul className="space-y-0.5 px-2 pb-3 pt-2">
          <NavRow label="Inbox settings" icon={Settings} />
          <NavRow label="Mark all as done" icon={CheckCircle2} />
        </ul>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-prisma-surface">
        <div className="flex items-end gap-8 border-b border-prisma-border px-8">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatus(tab.id)}
              className={cn(
                "-mb-px border-b-2 pb-3.5 pt-5 text-sm transition-colors",
                status === tab.id
                  ? "border-prisma-text font-medium text-prisma-text"
                  : "border-transparent text-prisma-muted hover:text-prisma-text",
              )}
            >
              {tab.label}{" "}
              <span className="text-prisma-muted">0</span>
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-8">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-prisma-border bg-prisma-canvas">
            <MessageSquare className="h-6 w-6 text-prisma-muted stroke-[1.5]" />
          </div>
          <h2 className="text-lg font-medium tracking-tight text-prisma-text">
            {emptyCopy[status].title}
          </h2>
          <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-prisma-muted">
            {emptyCopy[status].body}
          </p>
        </div>
      </main>
    </div>
  );
}

function ChannelButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof MessageSquare;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-white text-prisma-text"
          : "text-prisma-muted hover:text-prisma-text",
      )}
    >
      <Icon className="h-3.5 w-3.5 stroke-[1.5]" />
      {label}
    </button>
  );
}

function NavRow({
  label,
  icon: Icon,
  active = false,
  onClick,
}: {
  label: string;
  icon: typeof Inbox;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
          active
            ? "bg-white text-prisma-text"
            : "text-prisma-muted hover:bg-white/70 hover:text-prisma-text",
        )}
      >
        <Icon className="h-4 w-4 shrink-0 stroke-[1.5]" />
        <span className="truncate">{label}</span>
      </button>
    </li>
  );
}
