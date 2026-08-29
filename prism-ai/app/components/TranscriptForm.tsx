"use client";

import { FormEvent } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { SAMPLE_TRANSCRIPT } from "../lib/sample-transcript";

export function TranscriptForm({
  transcript,
  onTranscriptChange,
  onSubmit,
  isProcessing,
}: {
  transcript: string;
  onTranscriptChange: (value: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
}) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        value={transcript}
        onChange={(event) => onTranscriptChange(event.target.value)}
        placeholder="Paste (or type) a raw meeting transcript…"
        rows={6}
        className="w-full resize-y rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={isProcessing || !transcript.trim()}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {isProcessing ? "Processing meeting…" : "Process meeting"}
        </button>
        <button
          type="button"
          onClick={() => onTranscriptChange(SAMPLE_TRANSCRIPT)}
          disabled={isProcessing}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          <Wand2 className="size-4" />
          Use sample transcript
        </button>
      </div>
    </form>
  );
}
