"use client";

import { Fragment, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveTranscriptRail } from "@/components/meeting/LiveTranscriptRail";
import { MetricsStream } from "@/components/inbox/MetricsStream";
import { TasksTable } from "@/components/tickets/TasksTable";

type StatusTab = "tasks" | "moodboard" | "metrics";

const statusTabs: { id: StatusTab; label: string }[] = [
  { id: "tasks", label: "Tasks" },
  { id: "moodboard", label: "Moodboard" },
  { id: "metrics", label: "Metrics" },
];

export function InboxWorkspace() {
  const [status, setStatus] = useState<StatusTab>("metrics");
  const [listening, setListening] = useState(true);
  const [revealed, setRevealed] = useState(false);

  const showGenerating = listening && !revealed;
  const activeStatus = showGenerating ? "metrics" : status;

  return (
    <div className="relative flex h-screen overflow-hidden bg-prisma-canvas animate-fade-in">
      <aside className="flex w-16 shrink-0 flex-col bg-prisma-canvas px-2 pt-10">
        <Link
          href="/"
          aria-label="Main menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-prisma-muted transition-colors hover:bg-white/70 hover:text-prisma-text"
        >
          <ArrowLeft className="h-4 w-4 stroke-[1.5]" />
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 gap-2 bg-prisma-canvas">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col pt-10">
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col",
              showGenerating && "pointer-events-none select-none blur-[6px]",
            )}
            aria-hidden={showGenerating}
          >
            <div className="flex shrink-0 items-end border-b border-prisma-border">
              {statusTabs.map((tab, index) => {
                const active = activeStatus === tab.id;

                return (
                  <Fragment key={tab.id}>
                    {index > 0 && (
                      <div className="w-1 shrink-0" aria-hidden="true" />
                    )}
                    <button
                      type="button"
                      onClick={() => setStatus(tab.id)}
                      className={cn(
                        "relative border-x border-t border-prisma-border px-5 py-2 font-serif text-lg leading-snug tracking-tight transition-colors",
                        active
                          ? "z-10 bg-prisma-surface text-prisma-text after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-prisma-surface"
                          : "bg-[#E4E4DE] text-prisma-muted hover:text-prisma-text",
                      )}
                    >
                      {tab.label}
                    </button>
                  </Fragment>
                );
              })}
              <div className="min-w-0 flex-1" />
            </div>

            <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-x border-prisma-border bg-prisma-surface">
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col overflow-hidden",
                  activeStatus !== "tasks" && "hidden",
                )}
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <TasksTable />
                </div>
              </div>

              <div
                className={cn(
                  "flex min-h-0 flex-1 items-start justify-center overflow-auto px-8 py-8",
                  activeStatus !== "moodboard" && "hidden",
                )}
              >
                <div
                  className="relative flex aspect-[4/3] w-full max-w-lg items-center justify-center overflow-hidden rounded-md border border-prisma-border bg-prisma-canvas"
                  aria-busy="true"
                  aria-label="Generating moodboard image"
                >
                  <div
                    className="h-8 w-8 animate-spin rounded-full border-2 border-prisma-border border-t-prisma-text"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col overflow-hidden",
                  activeStatus !== "metrics" && "hidden",
                )}
              >
                <MetricsStream listening={listening} />
              </div>
            </main>
          </div>

          {showGenerating && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-8 pt-10">
              <Image
                src="/prisma-logo.svg"
                alt="Prisma"
                width={120}
                height={120}
                className="h-[88px] w-auto object-contain md:h-[104px]"
                priority
                unoptimized
              />
              <p className="animate-text-shine mt-6 font-serif text-3xl font-bold leading-snug tracking-tight md:text-4xl">
                Generating...
              </p>
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-prisma-text px-8 font-medium text-white transition-colors hover:bg-[#3a3a3a] focus:outline-none focus-visible:ring-2 focus-visible:ring-prisma-accent focus-visible:ring-offset-2 focus-visible:ring-offset-prisma-canvas"
              >
                View
              </button>
            </div>
          )}
        </div>

        <LiveTranscriptRail
          listening={listening}
          onTogglePause={() => setListening((prev) => !prev)}
        />
      </div>
    </div>
  );
}
