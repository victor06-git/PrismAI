"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Mic, Type, Zap } from "lucide-react";
import { clsx } from "clsx";
import { TranscriptForm } from "./components/TranscriptForm";
import { AudioRecorderPanel } from "./components/AudioRecorderPanel";
import { BacklogPanel } from "./components/BacklogPanel";
import { MoodboardPanel } from "./components/MoodboardPanel";
import { InsightsPanel } from "./components/InsightsPanel";
import { SkeletonCard } from "./components/Skeleton";
import { ApiError, processMeeting, transcribeAndOrchestrate } from "./lib/api";
import type { ProcessMeetingResponse } from "./lib/types";

const STAGE_LABEL: Record<string, string> = {
  uploading: "Uploading recording…",
  transcribing: "Transcribing with Whisper…",
  analyzing: "Extracting backlog, moodboards & insights…",
  generating_visuals_and_insights: "Generating images & enriching insights…",
  using_fallback_data: "Live services unavailable — using demo data…",
  done: "Done",
};

type InputMode = "transcript" | "audio";

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>("transcript");

  const [transcript, setTranscript] = useState("");
  const [recordedTranscript, setRecordedTranscript] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);

  const [result, setResult] = useState<ProcessMeetingResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleProcessMeeting() {
    setIsProcessing(true);
    setError(null);
    try {
      const response = await processMeeting(transcript);
      setResult(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong processing the meeting.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRecordingComplete(blob: Blob, mimeType: string) {
    setError(null);
    setResult(null);
    setRecordedTranscript(null);
    setIsProcessing(true);
    setPipelineStage("uploading");

    const extension = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "ogg";

    try {
      for await (const event of transcribeAndOrchestrate(blob, `recording.${extension}`)) {
        switch (event.type) {
          case "status":
            setPipelineStage(event.stage);
            break;
          case "transcript":
            setRecordedTranscript(event.transcript);
            break;
          case "extracted":
            setResult(event.data);
            break;
          case "visual_asset_ready":
            setResult((prev) =>
              prev
                ? {
                    ...prev,
                    visualAssets: prev.visualAssets.map((asset, i) =>
                      i === event.index ? { ...asset, imageUrl: event.imageUrl } : asset
                    ),
                  }
                : prev
            );
            break;
          case "insights_enriched":
            setResult((prev) => (prev ? { ...prev, dataInsights: event.dataInsights } : prev));
            break;
          case "done":
            setResult(event.data);
            setPipelineStage("done");
            break;
          case "error":
            setError(event.message);
            break;
          // "visual_asset_failed" is a soft failure — the card just keeps its prompt
          // and the manual "Generate image" button, same as the text-transcript flow.
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong processing the recording.");
    } finally {
      setIsProcessing(false);
    }
  }

  function switchMode(mode: InputMode) {
    setInputMode(mode);
    setError(null);
  }

  const showExtractionSkeleton =
    inputMode === "audio" && isProcessing && !result && pipelineStage !== "uploading";

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <header className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet-600 text-white">
            <Zap className="size-4" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">PrismAI</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Real-time meeting copilot — backlog, moodboards &amp; data insights, at once.
            </p>
          </div>
        </header>

        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950 w-fit">
          <button
            type="button"
            onClick={() => switchMode("transcript")}
            className={clsx(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              inputMode === "transcript"
                ? "bg-violet-600 text-white"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            <Type className="size-3.5" />
            Paste transcript
          </button>
          <button
            type="button"
            onClick={() => switchMode("audio")}
            className={clsx(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              inputMode === "audio"
                ? "bg-violet-600 text-white"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            )}
          >
            <Mic className="size-3.5" />
            Record audio
          </button>
        </div>

        {inputMode === "transcript" ? (
          <TranscriptForm
            transcript={transcript}
            onTranscriptChange={setTranscript}
            onSubmit={handleProcessMeeting}
            isProcessing={isProcessing}
          />
        ) : (
          <AudioRecorderPanel onRecordingComplete={handleRecordingComplete} disabled={isProcessing} />
        )}

        {inputMode === "audio" && pipelineStage && isProcessing && (
          <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200">
            <Loader2 className="size-4 animate-spin" />
            {STAGE_LABEL[pipelineStage] ?? pipelineStage}
          </div>
        )}

        {recordedTranscript && (
          <p className="rounded-xl border border-zinc-200 bg-white p-3 text-sm italic text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            “{recordedTranscript}”
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        {showExtractionSkeleton && (
          <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, col) => (
              <div key={col} className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ))}
          </div>
        )}

        {result && (
          <>
            <p className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200">
              {result.summary}
            </p>

            <div className="grid flex-1 grid-cols-1 gap-4 lg:h-[70vh] lg:grid-cols-3">
              <BacklogPanel tickets={result.tickets} />
              <MoodboardPanel visualAssets={result.visualAssets} />
              <InsightsPanel
                dataInsights={result.dataInsights}
                transcript={inputMode === "audio" ? (recordedTranscript ?? "") : transcript}
                onRefresh={(dataInsights) => setResult({ ...result, dataInsights })}
              />
            </div>
          </>
        )}

        {!result && !isProcessing && !error && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 p-16 text-center text-sm text-zinc-400 dark:border-zinc-800">
            {inputMode === "transcript"
              ? "Paste a meeting transcript above (or load the sample) to generate a backlog, moodboards and data insights simultaneously."
              : "Record a short meeting snippet above — PrismAI transcribes it live and streams back the backlog, moodboards and data insights as they're generated."}
          </div>
        )}
      </main>
    </div>
  );
}
