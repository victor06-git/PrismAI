"use client";

/**
 * High-framerate canvas waveform reacting to REAL mic input (0..1 RMS level
 * from useLiveAudioStream) — a rolling history of neon bars with a genuine
 * canvas glow (shadowBlur), redrawn every frame via requestAnimationFrame.
 * Level/active are read through refs inside the draw loop rather than
 * driving React re-renders 60x/sec, which would be wasteful for a value
 * that changes this often.
 */

import { useEffect, useRef } from "react";

interface VoiceVisualizerProps {
  /** 0..1 real mic input level. */
  level: number;
  active: boolean;
  className?: string;
  /** Vice City default: magenta -> cyan gradient with a real neon glow. */
  colorA?: string;
  colorB?: string;
}

const HISTORY_LENGTH = 64;

export function VoiceVisualizer({
  level,
  active,
  className,
  colorA = "#f472b6", // pink-400
  colorB = "#22d3ee", // cyan-400
}: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>(Array(HISTORY_LENGTH).fill(0));
  const levelRef = useRef(level);
  const activeRef = useRef(active);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    levelRef.current = level;
    activeRef.current = active;
  }, [level, active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!canvas || !ctx) return;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const history = historyRef.current;
      history.push(activeRef.current ? levelRef.current : 0);
      if (history.length > HISTORY_LENGTH) history.shift();

      const barSlot = width / HISTORY_LENGTH;
      const barWidth = barSlot * 0.58;
      const midY = height / 2;
      const radius = Math.min(barWidth / 2, 5 * dpr);

      history.forEach((value, i) => {
        const barHeight = Math.max(value * height * 0.94, height * 0.035);
        const x = i * barSlot + (barSlot - barWidth) / 2;
        const y = midY - barHeight / 2;
        const t = i / (HISTORY_LENGTH - 1);

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, colorA);
        gradient.addColorStop(1, colorB);

        ctx.save();
        ctx.shadowColor = t < 0.5 ? colorA : colorB;
        ctx.shadowBlur = 14 * dpr * Math.max(value, 0.15);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(x, y, barWidth, barHeight, radius);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
        ctx.restore();
      });

      frameRef.current = requestAnimationFrame(draw);
    }
    frameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [colorA, colorB]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
