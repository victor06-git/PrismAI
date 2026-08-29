"use client";

import { clsx } from "clsx";
import { Mic, Square } from "lucide-react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";

// Deterministic per-bar variance (no Math.random — avoids SSR/client hydration mismatches).
function barSeed(index: number): number {
  return Math.abs(Math.sin(index * 12.9898)) % 1;
}

export function AudioRecorderPanel({
  onRecordingComplete,
  disabled,
}: {
  onRecordingComplete: (blob: Blob, mimeType: string) => void;
  disabled?: boolean;
}) {
  const { status, elapsedSeconds, audioLevel, error, start, stop } = useAudioRecorder(onRecordingComplete);

  const minutes = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");
  const isRecording = status === "recording";

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <button
        type="button"
        onClick={isRecording ? stop : start}
        disabled={disabled}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        className={clsx(
          "flex size-16 items-center justify-center rounded-full text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          isRecording ? "animate-pulse bg-red-600 hover:bg-red-500" : "bg-violet-600 hover:bg-violet-500"
        )}
      >
        {isRecording ? <Square className="size-6" /> : <Mic className="size-6" />}
      </button>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {isRecording
          ? `Recording… ${minutes}:${seconds}`
          : status === "stopped"
            ? "Recording captured — uploading…"
            : "Tap to record a meeting snippet"}
      </p>

      {/* Live level meter — a row of bars driven by the mic's real RMS level. */}
      <div className="flex h-8 items-end gap-1" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => {
          const variance = 0.4 + barSeed(i) * 0.6;
          const height = isRecording ? Math.max(4, audioLevel * 32 * variance) : 4;
          return (
            <span
              key={i}
              className="w-1 rounded-full bg-violet-500 transition-[height] duration-75 dark:bg-violet-400"
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
