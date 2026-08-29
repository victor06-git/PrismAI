"use client";

/**
 * Real Fal.ai Flux Schnell renders (16:9), Vice City glass cards with
 * glowing neon borders, shimmering skeletons while a concept has no image
 * yet, click-to-expand modal with the full prompt. A custom dark modal
 * (not components/ui/Modal.tsx, which is light-themed) keeps this screen's
 * aesthetic cohesive. Framer Motion drives entrance + hover/tap interactions.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Expand, Image as ImageIcon, Sparkles, X } from "lucide-react";
import type { CreativeConcept } from "@/types";

function GalleryCard({ concept, onExpand }: { concept: CreativeConcept; onExpand: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-black/40 backdrop-blur-xl transition-shadow duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_36px_-10px_rgba(217,70,239,0.55)]"
    >
      <div className="relative aspect-video overflow-hidden bg-white/5">
        {concept.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={concept.imageUrl}
            alt={concept.title}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="animate-shimmer relative flex size-full items-center justify-center bg-gradient-to-br from-fuchsia-950/40 via-black to-cyan-950/40">
            <Sparkles className="size-6 animate-pulse text-fuchsia-300/70" />
          </div>
        )}

        {concept.imageUrl && (
          <motion.button
            type="button"
            onClick={onExpand}
            aria-label="Expand image"
            whileTap={{ scale: 0.9 }}
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
          >
            <Expand className="size-4" />
          </motion.button>
        )}
      </div>

      <div className="p-3">
        <h4 className="text-sm font-semibold tracking-tight text-white">{concept.title}</h4>
        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{concept.description}</p>
      </div>
    </motion.div>
  );
}

function ExpandedModal({ concept, onClose }: { concept: CreativeConcept; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-zinc-950 shadow-[0_0_60px_-15px_rgba(217,70,239,0.5)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80"
        >
          <X className="size-4" />
        </button>
        {concept.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={concept.imageUrl} alt={concept.title} className="aspect-video w-full object-cover" />
        )}
        <div className="p-5">
          <h3 className="text-base font-semibold tracking-tight text-white">{concept.title}</h3>
          <p className="mt-2 text-sm text-zinc-400">{concept.description}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function MoodboardGallery({ concepts, isActive }: { concepts: CreativeConcept[]; isActive: boolean }) {
  const [expanded, setExpanded] = useState<CreativeConcept | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {concepts.length === 0 && isActive && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-shimmer relative aspect-video overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-black/40"
              />
            ))}
          </>
        )}

        {concepts.length === 0 && !isActive && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-fuchsia-500/20 py-16 text-center">
            <ImageIcon className="mb-3 size-8 text-zinc-700" />
            <p className="text-sm text-zinc-600">Moodboards render here as design ideas come up in the meeting.</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {concepts.map((concept) => (
            <GalleryCard key={concept.id} concept={concept} onExpand={() => setExpanded(concept)} />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {expanded && <ExpandedModal concept={expanded} onClose={() => setExpanded(null)} />}
      </AnimatePresence>
    </>
  );
}
