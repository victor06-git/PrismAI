"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Sparkles, ImageIcon } from "lucide-react";
import { generateAsset, ApiError } from "../lib/api";
import type { VisualAssetPrompt } from "../lib/types";

type AssetState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; imageUrl: string };

function MoodboardCard({ asset }: { asset: VisualAssetPrompt }) {
  const [state, setState] = useState<AssetState>(
    asset.imageUrl ? { status: "done", imageUrl: asset.imageUrl } : { status: "idle" }
  );
  // Tracks the last imageUrl we've already reacted to, so the render-time
  // adjustment below (React's documented "adjusting state when a prop
  // changes" pattern — https://react.dev/learn/you-might-not-need-an-effect)
  // fires exactly once per new URL instead of looping.
  const [seenImageUrl, setSeenImageUrl] = useState(asset.imageUrl ?? null);

  // The audio pipeline streams images in after the card first renders (prompt
  // arrives before Fal.ai finishes) — pick up that later imageUrl without
  // clobbering a manual generate/regenerate the user already triggered.
  if (asset.imageUrl !== seenImageUrl) {
    setSeenImageUrl(asset.imageUrl ?? null);
    if (asset.imageUrl && state.status === "idle") {
      setState({ status: "done", imageUrl: asset.imageUrl });
    }
  }

  async function handleGenerate() {
    setState({ status: "loading" });
    try {
      const { imageUrl } = await generateAsset(asset.falPrompt);
      setState({ status: "done", imageUrl });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof ApiError ? err.message : "Image generation failed.",
      });
    }
  }

  return (
    <li className="animate-card-in overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex aspect-video items-center justify-center bg-zinc-100 dark:bg-zinc-900">
        {state.status === "done" ? (
          // Generated image URLs come from Fal.ai's own dynamic media host —
          // plain <img> avoids configuring next.config.ts image domains for a demo.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.imageUrl} alt={asset.assetName} className="size-full object-cover" />
        ) : state.status === "loading" ? (
          <Loader2 className="size-6 animate-spin text-violet-500" />
        ) : (
          <ImageIcon className="size-6 text-zinc-300 dark:text-zinc-700" />
        )}
      </div>

      <div className="p-4">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{asset.assetName}</h3>
        <p className="mt-1 line-clamp-3 text-xs text-zinc-500 dark:text-zinc-400">{asset.falPrompt}</p>

        {state.status === "error" && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {state.message}
          </p>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={state.status === "loading"}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-50 transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Sparkles className="size-3.5" />
          {state.status === "loading"
            ? "Generating…"
            : state.status === "done"
              ? "Regenerate"
              : "Generate image"}
        </button>
      </div>
    </li>
  );
}

export function MoodboardPanel({ visualAssets }: { visualAssets: VisualAssetPrompt[] }) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4 text-violet-600 dark:text-violet-400" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Moodboards</h2>
        </div>
        <span className="text-xs text-zinc-500">{visualAssets.length} prompts</span>
      </header>
      <ul className="flex-1 space-y-3 overflow-y-auto p-4">
        {visualAssets.map((asset) => (
          <MoodboardCard key={asset.assetName} asset={asset} />
        ))}
      </ul>
    </section>
  );
}
