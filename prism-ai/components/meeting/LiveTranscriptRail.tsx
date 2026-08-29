"use client";

/**
 * Collapsible transcript rail. Previously drove a fake word-by-word replay
 * of a hardcoded script (data/mockData.ts's demoTranscript) — that's gone;
 * this project's real live transcript lives on /meetings (useLiveMeeting +
 * the WebSocket /ws/live pipeline). This rail keeps its open/close chrome
 * for InboxWorkspace but no longer fabricates anything — pass real lines in
 * if/when this view is wired to real data.
 */

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptLine } from "@/types";

interface LiveTranscriptRailProps {
  open: boolean;
  onToggle: () => void;
  listening: boolean;
  lines?: TranscriptLine[];
}

export function LiveTranscriptRail({ open, onToggle, listening, lines = [] }: LiveTranscriptRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lines]);

  return (
    <aside className="relative flex h-full shrink-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? "Close transcript" : "Open transcript"}
        className={cn(
          "absolute top-1/2 z-30 flex h-16 w-5 -translate-y-1/2 items-center justify-center text-prisma-muted transition-colors hover:text-prisma-text",
          open
            ? "left-0 rounded-r-md"
            : "left-0 -translate-x-full rounded-l-md border border-r-0 border-[#D0D0C8] bg-[#D8D8D1]",
        )}
      >
        {open ? <ChevronRight className="h-4 w-4 stroke-[1.5]" /> : <ChevronLeft className="h-4 w-4 stroke-[1.5]" />}
      </button>

      <div
        className={cn(
          "flex h-full overflow-hidden rounded-t-md bg-[#D8D8D1] transition-[width] duration-300 ease-out",
          open ? "w-[340px]" : "w-0",
        )}
      >
        <div className="flex h-full w-[340px] shrink-0 flex-col pt-5">
          <header className="flex shrink-0 items-center justify-between px-5 pb-5">
            <h2 className="font-serif text-lg font-semibold leading-snug tracking-tight text-prisma-text">
              Transcript
            </h2>
            <span
              className={cn(
                "flex items-center gap-1.5 text-[11px]",
                listening ? "text-prisma-danger" : "text-prisma-muted",
              )}
            >
              <span className="relative flex h-1.5 w-1.5">
                {listening && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-prisma-danger opacity-60" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-1.5 w-1.5 rounded-full",
                    listening ? "bg-prisma-danger" : "bg-[#C8C8C2]",
                  )}
                />
              </span>
              {listening ? "Live" : "Idle"}
            </span>
          </header>

          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-5 pt-2">
            {lines.length === 0 && (
              <p className="px-2 pt-6 text-center text-xs leading-relaxed text-prisma-muted">
                {listening
                  ? "Listening… transcript will appear here as words are recognized."
                  : "No transcript yet. Start a meeting on the Meetings page to record one."}
              </p>
            )}
            {lines.map((line, index) => {
              // Alternating light/dark bubbles purely for visual rhythm — a
              // single mic has no real speaker diarization, so this never
              // claims to separate who said what, just breaks up a wall of
              // text the way a chat log does.
              const isLight = index % 2 === 0;
              return (
                <article key={line.id} className="flex justify-start">
                  <p
                    className={cn(
                      "w-fit max-w-[85%] rounded-[18px] px-3.5 py-2 text-sm leading-relaxed",
                      isLight ? "bg-white text-prisma-text" : "bg-[#1c1c1c] text-white",
                    )}
                  >
                    {line.text}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
