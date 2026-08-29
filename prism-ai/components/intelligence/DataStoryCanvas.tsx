"use client";

/**
 * Cala "Data as Art" — an interactive bento canvas, not a spreadsheet.
 * Each card's real-world `comparison` analogy is the headline; size on the
 * grid is driven by `magnitude` (a rough narrative scale, not a precise
 * measurement — see backend/schemas.py's CalaDataInsight docstring). Tap a
 * card to flip it and see the raw metric behind the story.
 *
 * Provenance is shown honestly: "Verified by Cala" only appears on cards
 * Cala's real entity/fact-lookup API actually returned (source: "cala");
 * everything else is clearly badged "AI insight" (source: "ai") — an
 * LLM-narrated estimate, never presented as a verified fact.
 *
 * The flip uses the `grid-area: 1/1` overlap technique (both faces share
 * one implicit grid cell) rather than absolute-positioning the back face —
 * robust against percentage-height 3D-transform quirks that a naive
 * position:absolute flip card runs into.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, CheckCircle2, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataStoryMagnitude, KpiInsight } from "@/types";

const MAGNITUDE_SPAN: Record<DataStoryMagnitude, string> = {
  intimate: "sm:col-span-2",
  notable: "sm:col-span-2",
  big: "sm:col-span-3",
  massive: "sm:col-span-4",
};

const MAGNITUDE_TEXT: Record<DataStoryMagnitude, string> = {
  intimate: "text-lg sm:text-xl",
  notable: "text-xl sm:text-2xl",
  big: "text-2xl sm:text-3xl",
  massive: "text-3xl sm:text-5xl",
};

const MAGNITUDE_GRADIENT: Record<DataStoryMagnitude, string> = {
  intimate: "from-fuchsia-500/15 via-transparent to-transparent",
  notable: "from-fuchsia-500/20 via-purple-500/10 to-transparent",
  big: "from-fuchsia-500/25 via-purple-500/15 to-cyan-500/10",
  massive: "from-fuchsia-500/35 via-purple-500/20 to-cyan-500/20",
};

const MAGNITUDE_MIN_HEIGHT: Record<DataStoryMagnitude, string> = {
  intimate: "min-h-[150px]",
  notable: "min-h-[160px]",
  big: "min-h-[190px]",
  massive: "min-h-[230px]",
};

const TREND_ICON = { up: ArrowUp, down: ArrowDown, neutral: Minus };
const TREND_COLOR = { up: "text-emerald-300", down: "text-rose-300", neutral: "text-zinc-500" };

function StoryCard({ insight, index }: { insight: KpiInsight; index: number }) {
  const [flipped, setFlipped] = useState(false);
  const TrendIcon = TREND_ICON[insight.trend];

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, scale: 0.85, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay: index * 0.04 }}
      onClick={() => setFlipped((f) => !f)}
      aria-label={`${insight.comparison} — tap to see the raw number`}
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-5 text-left backdrop-blur-xl [perspective:1400px]",
        MAGNITUDE_SPAN[insight.magnitude],
        MAGNITUDE_MIN_HEIGHT[insight.magnitude],
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", MAGNITUDE_GRADIENT[insight.magnitude])} />

      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 220, damping: 24 }}
        className="relative grid h-full [transform-style:preserve-3d]"
      >
        {/* Front — the story */}
        <div className="relative col-start-1 row-start-1 flex h-full flex-col justify-between gap-3 [backface-visibility:hidden]">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                insight.source === "cala"
                  ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-300"
                  : "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300",
              )}
            >
              {insight.source === "cala" ? <CheckCircle2 className="size-3" /> : <Sparkles className="size-3" />}
              {insight.source === "cala" ? "Verified by Cala" : "AI insight"}
            </span>
            <TrendIcon className={cn("size-4 shrink-0", TREND_COLOR[insight.trend])} />
          </div>

          <p className={cn("font-serif font-medium leading-snug text-white", MAGNITUDE_TEXT[insight.magnitude])}>
            {insight.comparison}
          </p>

          <p className="text-xs text-zinc-400">
            {insight.metric}: <span className="font-semibold text-zinc-200">{insight.value}</span>
          </p>
        </div>

        {/* Back — the raw metric */}
        <div
          className="relative col-start-1 row-start-1 flex h-full flex-col justify-center gap-2 [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)" }}
        >
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">{insight.question}</p>
          <p className="text-sm leading-relaxed text-zinc-300">{insight.context}</p>
        </div>
      </motion.div>
    </motion.button>
  );
}

export function DataStoryCanvas({ insights, isActive }: { insights: KpiInsight[]; isActive: boolean }) {
  return (
    <div>
      {insights.length > 0 && <p className="mb-4 text-xs text-zinc-500">Tap a card to flip it and see the raw number.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {insights.length === 0 && isActive && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-shimmer relative col-span-2 h-40 overflow-hidden rounded-3xl border border-white/10 bg-black/40"
              />
            ))}
          </>
        )}
        {insights.length === 0 && !isActive && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-fuchsia-500/20 py-16 text-center">
            <p className="max-w-sm text-sm text-zinc-600">
              Curious numbers and real facts Cala recognizes will render here as artful, tappable cards — not a table.
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {insights.map((insight, i) => (
            <StoryCard key={insight.id} insight={insight} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
