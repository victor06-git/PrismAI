"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { demoTranscript, teamMembers } from "@/data/mockData";

interface LiveTranscriptRailProps {
  open: boolean;
  onToggle: () => void;
  listening: boolean;
}

interface StreamedLine {
  id: string;
  speaker: string;
  displayedText: string;
}

function isOutgoing(speaker: string) {
  const index = teamMembers.findIndex((member) => member.name === speaker);
  return (index < 0 ? speaker.length : index) % 2 === 0;
}

function wordsOf(text: string) {
  return text.split(/\s+/).filter(Boolean);
}

export function LiveTranscriptRail({
  open,
  onToggle,
  listening,
}: LiveTranscriptRailProps) {
  const [lines, setLines] = useState<StreamedLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef({ lineIndex: 0, wordIndex: 0 });

  useEffect(() => {
    if (!listening) return;

    let cancelled = false;
    let timeout = 0;

    const schedule = (ms: number, fn: () => void) => {
      timeout = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    };

    const tick = () => {
      const progress = progressRef.current;
      if (progress.lineIndex >= demoTranscript.length) return;

      const source = demoTranscript[progress.lineIndex];
      const words = wordsOf(source.text);

      if (progress.wordIndex === 0) {
        setLines((current) => [
          ...current,
          { id: source.id, speaker: source.speaker, displayedText: words[0] ?? "" },
        ]);
        progress.wordIndex = 1;
      } else {
        progress.wordIndex += 1;
        const displayed = words.slice(0, progress.wordIndex).join(" ");
        setLines((current) => {
          const next = [...current];
          const last = next[next.length - 1];
          if (!last) return current;
          next[next.length - 1] = { ...last, displayedText: displayed };
          return next;
        });
      }

      if (progress.wordIndex >= words.length) {
        progress.lineIndex += 1;
        progress.wordIndex = 0;
        schedule(640, tick);
        return;
      }

      schedule(88, tick);
    };

    schedule(480, tick);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [listening]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lines]);

  const lastSource = demoTranscript[lines.length - 1];
  const lastLine = lines[lines.length - 1];
  const typing =
    listening &&
    Boolean(lastLine) &&
    Boolean(lastSource) &&
    lastLine.displayedText !== lastSource.text;
  const recording =
    listening &&
    (progressRef.current.lineIndex < demoTranscript.length || typing);

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
        {open ? (
          <ChevronRight className="h-4 w-4 stroke-[1.5]" />
        ) : (
          <ChevronLeft className="h-4 w-4 stroke-[1.5]" />
        )}
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
                recording ? "text-prisma-danger" : "text-prisma-muted",
              )}
            >
              <span className="relative flex h-1.5 w-1.5">
                {recording && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-prisma-danger opacity-60" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-1.5 w-1.5 rounded-full",
                    recording ? "bg-prisma-danger" : "bg-[#C8C8C2]",
                  )}
                />
              </span>
              {recording ? "Live" : listening ? "Paused" : "Idle"}
            </span>
          </header>

          <div
            ref={scrollRef}
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-5 pt-2"
          >
            {lines.map((line, index) => {
              const outgoing = isOutgoing(line.speaker);
              const isTyping = typing && index === lines.length - 1;

              return (
                <article
                  key={line.id}
                  className={cn(
                    "flex",
                    outgoing ? "justify-end" : "justify-start",
                  )}
                >
                  <p
                    className={cn(
                      "w-fit max-w-[85%] rounded-[18px] px-3.5 py-2 text-sm leading-relaxed",
                      outgoing
                        ? "bg-[#1E4550] text-white"
                        : "bg-white text-prisma-text",
                    )}
                  >
                    {line.displayedText}
                    {isTyping && (
                      <span
                        className={cn(
                          "ml-0.5 inline-block h-3 w-px translate-y-[1px] animate-pulse align-middle",
                          outgoing ? "bg-white/80" : "bg-prisma-text",
                        )}
                      />
                    )}
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
