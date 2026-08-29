"use client";

import { Pause, Play, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const WAVE_BARS = [
  0.35, 0.55, 0.9, 0.45, 0.7, 1, 0.5, 0.8, 0.4, 0.65, 0.85, 0.5, 0.75, 0.4,
  0.95, 0.55, 0.7, 0.35, 0.6,
];

interface ListeningBarProps {
  listening: boolean;
  onTogglePause: () => void;
  onComplete?: () => void;
}

export function ListeningBar({
  listening,
  onTogglePause,
  onComplete,
}: ListeningBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-6 pb-6">
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-1.5 rounded-full bg-prisma-text px-1.5 py-1",
          "animate-slide-in-up",
        )}
        role="status"
        aria-label={listening ? "Listening" : "Paused"}
      >
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={listening ? "Pause listening" : "Resume listening"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-prisma-canvas text-prisma-text transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-prisma-accent focus-visible:ring-offset-1 focus-visible:ring-offset-prisma-text"
        >
          {listening ? (
            <Pause className="h-3 w-3 fill-current" strokeWidth={0} />
          ) : (
            <Play className="h-3 w-3 fill-current" strokeWidth={0} />
          )}
        </button>

        <div className="flex h-7 min-w-[112px] items-center justify-center rounded-full bg-prisma-canvas px-3">
          <div className="flex h-3.5 items-end gap-[2px]">
            {WAVE_BARS.map((height, index) => (
              <span
                key={index}
                className={cn(
                  "w-[2px] rounded-full bg-prisma-text",
                  listening && "animate-waveform",
                )}
                style={{
                  height: `${Math.max(height * 100, 18)}%`,
                  animationDelay: listening ? `${(index % 8) * 0.08}s` : undefined,
                  opacity: listening ? 1 : 0.45,
                  transform: listening ? undefined : "scaleY(0.35)",
                }}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onComplete}
          aria-label="Finish listening"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-prisma-canvas text-prisma-text transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-prisma-accent focus-visible:ring-offset-1 focus-visible:ring-offset-prisma-text"
        >
          <Check className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
