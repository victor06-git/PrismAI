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
  /** 0..1 real mic input level (from useLiveAudioStream/useAudioRecorder) — when
   * provided, bars pulse with the actual microphone signal instead of the
   * canned CSS waveform animation. */
  level?: number;
}

export function ListeningBar({
  listening,
  onTogglePause,
  level,
}: ListeningBarProps) {
  const isLive = level !== undefined;

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
            {WAVE_BARS.map((shapeRatio, index) => {
              const heightPct = isLive
                ? Math.max((listening ? (level ?? 0) : 0) * shapeRatio * 100, 16)
                : Math.max(shapeRatio * 100, 16);
              return (
                <span
                  key={index}
                  className={cn(
                    "w-[1.5px] rounded-full bg-white",
                    !isLive && listening && "animate-waveform",
                    isLive && "transition-[height] duration-75",
                  )}
                  style={{
                    height: `${heightPct}%`,
                    animationDelay: !isLive && listening ? `${(index % 8) * 0.08}s` : undefined,
                    opacity: listening ? 1 : 0.4,
                    transform: !isLive && !listening ? "scaleY(0.35)" : undefined,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
