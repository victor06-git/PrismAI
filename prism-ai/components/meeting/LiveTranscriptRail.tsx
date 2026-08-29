"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { demoTranscript, teamMembers } from "@/data/mockData";
import { ListeningBar } from "@/components/meeting/ListeningBar";

interface LiveTranscriptRailProps {
  listening: boolean;
  onTogglePause: () => void;
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
  listening,
  onTogglePause,
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
    <aside className="flex h-full w-[340px] shrink-0 flex-col overflow-hidden border-b border-solid border-[#C4C4BC] bg-[#D8D8D1] pt-5">
      <header className="flex shrink-0 items-center justify-between border-b border-solid border-[#C4C4BC] px-5 pb-5">
        <h2 className="font-serif text-lg font-semibold leading-snug tracking-tight text-prisma-text">
          Transcript
        </h2>
        <span
          className={cn(
            "flex items-center gap-1.5 font-serif text-lg font-semibold leading-snug tracking-tight",
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
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3 pt-2"
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

      <ListeningBar listening={listening} onTogglePause={onTogglePause} />
    </aside>
  );
}
