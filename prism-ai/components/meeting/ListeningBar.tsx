"use client";

import { cn } from "@/lib/utils";

const WAVE_BARS = [
  0.3, 0.55, 0.9, 0.4, 0.7, 1, 0.45, 0.8, 0.35, 0.65, 0.85, 0.5, 0.75, 0.4,
  0.95, 0.55, 0.7, 0.35,
];

interface ListeningBarProps {
  listening: boolean;
  onTogglePause: () => void;
}

export function ListeningBar({
  listening,
  onTogglePause,
}: ListeningBarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-center px-6 pb-6 pt-3"
      role="status"
      aria-label={listening ? "Listening" : "Paused"}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={listening ? "Pause recording" : "Resume recording"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E8E8E0] bg-prisma-canvas transition-colors hover:bg-[#EFEFE8] focus:outline-none focus-visible:ring-2 focus-visible:ring-prisma-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#D8D8D1]"
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
                  height: `${Math.max(height * 100, 16)}%`,
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
      </div>
    </div>
  );
}
