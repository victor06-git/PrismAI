"use client";

import { cn } from "@/lib/utils";

const WAVE_BARS = [
  0.3, 0.55, 0.9, 0.4, 0.7, 1, 0.45, 0.8, 0.35, 0.65, 0.85, 0.5, 0.75, 0.4,
  0.95, 0.55, 0.7, 0.35,
];

interface ListeningBarProps {
  listening: boolean;
  onTogglePause: () => void;
  onComplete?: () => void;
  level?: number;
}

export function ListeningBar({
  listening,
  onTogglePause,
  onComplete,
  level = 0,
}: ListeningBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-6 pb-6">
      <div
        className="pointer-events-auto flex items-center gap-2 animate-slide-in-up"
        role="status"
        aria-label={listening ? "Listening" : "Paused"}
      >
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={listening ? "Pause recording" : "Resume recording"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E8E8E0] bg-prisma-canvas transition-colors hover:bg-[#EFEFE8] focus:outline-none focus-visible:ring-2 focus-visible:ring-prisma-accent focus-visible:ring-offset-2 focus-visible:ring-offset-prisma-surface"
        >
          <span className="block h-2.5 w-2.5 rounded-[2px] bg-white" />
        </button>

        <div className="flex h-6 w-[72px] items-center justify-center rounded-full bg-prisma-text px-2">
          <div className="flex h-2.5 w-full items-end justify-center gap-[1.5px]">
            {WAVE_BARS.map((height, index) => (
              <span
                key={index}
                className={cn(
                  "w-[1.5px] rounded-full bg-white",
                  listening && "animate-waveform",
                )}
                style={{
                  height: `${Math.max((listening ? Math.max(level, 0.12) : 0.16) * height * 100, 16)}%`,
                  animationDelay: listening
                    ? `${(index % 8) * 0.08}s`
                    : undefined,
                  opacity: listening ? 1 : 0.4,
                  transform: listening ? undefined : "scaleY(0.35)",
                }}
              />
            ))}
          </div>
        </div>

        {onComplete && (
          <button
            type="button"
            onClick={onComplete}
            className="rounded-full bg-prisma-text px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[#3A3A3A]"
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
}
