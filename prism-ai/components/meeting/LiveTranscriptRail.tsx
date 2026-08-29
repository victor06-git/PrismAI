"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveTranscriptRailProps {
  open: boolean;
  onToggle: () => void;
  listening: boolean;
  lines: string[];
  partial?: string;
}

export function LiveTranscriptRail({ open, onToggle, listening, lines, partial = "" }: LiveTranscriptRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lines, partial]);

  return (
    <aside className="relative flex h-full shrink-0">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? "Close transcript" : "Open transcript"} className={cn("absolute top-1/2 z-30 flex h-16 w-5 -translate-y-1/2 items-center justify-center text-prisma-muted transition-colors hover:text-prisma-text", open ? "left-0 rounded-r-md" : "left-0 -translate-x-full rounded-l-md border border-r-0 border-[#D0D0C8] bg-[#D8D8D1]")}>
        {open ? <ChevronRight className="h-4 w-4 stroke-[1.5]" /> : <ChevronLeft className="h-4 w-4 stroke-[1.5]" />}
      </button>
      <div className={cn("flex h-full overflow-hidden rounded-t-md bg-[#D8D8D1] transition-[width] duration-300 ease-out", open ? "w-[340px]" : "w-0")}>
        <div className="flex h-full w-[340px] shrink-0 flex-col pt-5">
          <header className="flex shrink-0 items-center justify-between px-5 pb-5">
            <h2 className="font-serif text-lg font-semibold tracking-tight text-prisma-text">Transcript</h2>
            <span className={cn("flex items-center gap-1.5 text-[11px]", listening ? "text-prisma-danger" : "text-prisma-muted")}>
              <span className="relative flex h-1.5 w-1.5">
                {listening && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-prisma-danger opacity-60" />}
                <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", listening ? "bg-prisma-danger" : "bg-[#C8C8C2]")} />
              </span>
              {listening ? "Live" : "Idle"}
            </span>
          </header>
          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-5 pt-2">
            {!lines.length && !partial && <p className="px-2 text-sm leading-relaxed text-prisma-muted">Your live transcript will appear here.</p>}
            {lines.map((line, index) => <article key={`${index}-${line.slice(0, 18)}`} className={cn("flex", index % 2 === 0 ? "justify-end" : "justify-start")}><p className={cn("w-fit max-w-[85%] rounded-[18px] px-3.5 py-2 text-sm leading-relaxed", index % 2 === 0 ? "bg-[#1E4550] text-white" : "bg-white text-prisma-text")}>{line}</p></article>)}
            {partial && <article className="flex justify-end"><p className="w-fit max-w-[85%] rounded-[18px] bg-[#1E4550] px-3.5 py-2 text-sm leading-relaxed text-white">{partial}<span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-white/80" /></p></article>}
          </div>
        </div>
      </div>
    </aside>
  );
}
