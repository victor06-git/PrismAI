"use client";

import { useState } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { ApiError, fetchDataInsights } from "../lib/api";
import type { CalaDataInsight, InsightTrend } from "../lib/types";

const TREND_META: Record<InsightTrend, { Icon: typeof ArrowUpRight; className: string }> = {
  up: { Icon: ArrowUpRight, className: "text-emerald-600 dark:text-emerald-400" },
  down: { Icon: ArrowDownRight, className: "text-red-600 dark:text-red-400" },
  flat: { Icon: Minus, className: "text-zinc-400 dark:text-zinc-500" },
};

function InsightCard({ insight }: { insight: CalaDataInsight }) {
  const { Icon, className } = TREND_META[insight.trend];
  return (
    <li className="animate-card-in rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{insight.metricTarget}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{insight.value}</span>
        <Icon className={clsx("size-4", className)} />
      </div>
      <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">{insight.question}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{insight.summary}</p>
    </li>
  );
}

export function InsightsPanel({
  dataInsights,
  transcript,
  onRefresh,
}: {
  dataInsights: CalaDataInsight[];
  transcript: string;
  onRefresh: (insights: CalaDataInsight[]) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const { dataInsights: fresh } = await fetchDataInsights(transcript);
      onRefresh(fresh);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh insights.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Data Insights <span className="font-normal text-zinc-400">· Cala</span>
        </h2>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <RefreshCw className={clsx("size-3.5", refreshing && "animate-spin")} />
          Refresh
        </button>
      </header>

      {error && (
        <p className="flex items-start gap-1.5 px-4 pt-3 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}

      <ul className="flex-1 space-y-3 overflow-y-auto p-4">
        {dataInsights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </ul>
    </section>
  );
}
