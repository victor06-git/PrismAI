"use client";

/**
 * Drives the WebSocket /ws/live progressive pipeline: real microphone level
 * (AudioContext + AnalyserNode) for the waveform bar, plus a continuous
 * raw-PCM capture (AudioWorklet) that cuts and streams WAV segments to the
 * backend and forwards every typed event it sends back (TRANSCRIPT_UPDATE,
 * NEW_TICKET, MOODBOARD_IMAGE, CALA_METRIC, STATUS, ERROR) to the caller.
 *
 * Chunking approach (see backend/audio/live_session.py for the server-side
 * half of this): earlier versions stopped/restarted a MediaRecorder every
 * ~4s, which reliably split words sitting across that boundary — the
 * restart has to fully re-init a new encoder, so there's no way to hand it
 * a lead-in. Capturing raw PCM directly via an AudioWorklet instead means
 * there's a continuous, gapless sample stream to cut from, which enables
 * two real fixes:
 *   1. Lightweight VAD: a segment only cuts on a detected silence gap (or a
 *      hard duration cap, whichever comes first) — cuts land between words
 *      whenever there's a natural pause to land in, instead of at an
 *      arbitrary fixed tick.
 *   2. Overlap: every new segment carries a short lead-in of trailing audio
 *      from the previous one, so even a hard-cap cut mid-word still leaves
 *      that word intact in at least one of the two segments. The backend
 *      trims the resulting duplicate words back out before they reach the
 *      transcript (see live_session.py's _dedupe_segment_overlap).
 * Getting boundary loss to *zero* still needs OpenAI's separate Realtime
 * API (a materially different integration) — this hook doesn't claim that,
 * only to make it the rare/partial exception instead of the norm.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveServerEvent } from "@/lib/backendTypes";

export type LiveStreamStatus = "idle" | "connecting" | "streaming" | "paused" | "stopped" | "error";

export interface UseLiveAudioStreamResult {
  status: LiveStreamStatus;
  /** 0..1 live input level, sampled continuously while connected — drive a waveform/meter with it. */
  audioLevel: number;
  elapsedSeconds: number;
  error: string | null;
  start: (meetingId?: string) => Promise<void>;
  stop: () => void;
  togglePause: () => void;
  reset: () => void;
}

// --- Segment-cutting tuning -------------------------------------------------
const TARGET_SEGMENT_MS = 4000; // preferred segment length once a silence gap is available to cut at
const MAX_SEGMENT_MS = 7000; // hard cap so a long uninterrupted monologue still gets cut somewhere
const MIN_SEGMENT_MS = 1500; // never cut a segment shorter than this (avoids a flurry of tiny segments)
const SILENCE_GAP_MS = 250; // how much continuous quiet counts as "a pause to cut at"
const OVERLAP_MS = 400; // trailing audio carried into the next segment, so a hard-cap cut can't fully lose a word
const SILENCE_RMS_THRESHOLD = 0.015; // raw [-1,1] PCM RMS below this counts as silence (typical mic noise floor is well under this; speech is well over it)
const MIN_FLUSH_MS = 300; // don't bother sending a pause/stop-triggered segment shorter than this — not enough audio to transcribe meaningfully

function deriveWsUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "http://localhost:8000";
  return base.replace(/^http/, "ws") + "/ws/live";
}

function computeRms(samples: Float32Array): number {
  let sumSquares = 0;
  for (const sample of samples) sumSquares += sample * sample;
  return Math.sqrt(sumSquares / samples.length);
}

function flattenChunks(chunks: Float32Array[], totalLength: number): Float32Array {
  const out = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Encodes mono Float32 PCM as a standard 16-bit PCM WAV file — self-contained
 * regardless of where it's cut from, unlike a MediaRecorder container chunk. */
function encodeWavPCM16(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function useLiveAudioStream(
  onEvent: (event: LiveServerEvent) => void,
  onError?: (message: string) => void
): UseLiveAudioStreamResult {
  const [status, setStatus] = useState<LiveStreamStatus>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const levelFrameRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);
  const stoppedRef = useRef(true);

  // Raw-PCM segment buffer — plain refs, never React state, since these are
  // rewritten many times a second and must never trigger a render.
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const totalSamplesRef = useRef(0);
  const silentSamplesRef = useRef(0);
  const capturingRef = useRef(false);
  const sampleRateRef = useRef(0);

  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onEventRef.current = onEvent;
    onErrorRef.current = onError;
  }, [onEvent, onError]);

  const stopLevelMonitor = useCallback(() => {
    if (levelFrameRef.current !== null) cancelAnimationFrame(levelFrameRef.current);
    levelFrameRef.current = null;
  }, []);

  const startLevelMonitor = useCallback((audioContext: AudioContext, source: MediaStreamAudioSourceNode) => {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (const value of data) {
        const normalized = (value - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      setAudioLevel(Math.min(1, rms * 4)); // raw mic RMS is quiet — scale up for a visible meter
      levelFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const resetSegmentBuffer = useCallback(() => {
    pcmChunksRef.current = [];
    totalSamplesRef.current = 0;
    silentSamplesRef.current = 0;
  }, []);

  const sendSegment = useCallback((blob: Blob) => {
    if (blob.size === 0 || wsRef.current?.readyState !== WebSocket.OPEN) return;
    void blob.arrayBuffer().then((buffer) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(buffer);
    });
  }, []);

  // Cuts whatever is currently buffered into one WAV segment and sends it.
  // `carryOverlap`: true for a normal in-flow cut (keeps the trailing
  // OVERLAP_MS as the start of the next segment); false for a pause/stop
  // flush (nothing follows immediately, so there's nothing to carry into).
  const cutSegment = useCallback(
    (carryOverlap: boolean, minMs: number) => {
      const sampleRate = sampleRateRef.current;
      const totalSamples = totalSamplesRef.current;
      if (!sampleRate || totalSamples === 0) return;
      if ((totalSamples / sampleRate) * 1000 < minMs) return;

      const flat = flattenChunks(pcmChunksRef.current, totalSamples);
      sendSegment(encodeWavPCM16(flat, sampleRate));

      if (carryOverlap) {
        const overlapSamples = Math.min(flat.length, Math.round((OVERLAP_MS / 1000) * sampleRate));
        const tail = flat.slice(flat.length - overlapSamples);
        pcmChunksRef.current = [tail];
        totalSamplesRef.current = tail.length;
      } else {
        pcmChunksRef.current = [];
        totalSamplesRef.current = 0;
      }
      silentSamplesRef.current = 0;
    },
    [sendSegment]
  );

  const handleWorkletMessage = useCallback(
    (event: MessageEvent<Float32Array>) => {
      if (!capturingRef.current) return;
      const chunk = event.data;
      pcmChunksRef.current.push(chunk);
      totalSamplesRef.current += chunk.length;
      silentSamplesRef.current = computeRms(chunk) < SILENCE_RMS_THRESHOLD ? silentSamplesRef.current + chunk.length : 0;

      const sampleRate = sampleRateRef.current;
      if (!sampleRate) return;
      const totalMs = (totalSamplesRef.current / sampleRate) * 1000;
      if (totalMs < MIN_SEGMENT_MS) return;

      const reachedMax = totalMs >= MAX_SEGMENT_MS;
      const reachedTargetInSilence =
        totalMs >= TARGET_SEGMENT_MS && (silentSamplesRef.current / sampleRate) * 1000 >= SILENCE_GAP_MS;

      if (reachedMax || reachedTargetInSilence) {
        cutSegment(true, 0);
      }
    },
    [cutSegment]
  );

  const cleanupMedia = useCallback(() => {
    stopLevelMonitor();
    if (elapsedTimerRef.current !== null) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = null;
    capturingRef.current = false;
    resetSegmentBuffer();
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
    }
    workletNodeRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    sampleRateRef.current = 0;
  }, [stopLevelMonitor, resetSegmentBuffer]);

  const start = useCallback(
    async (meetingId?: string) => {
      setError(null);
      setStatus("connecting");
      stoppedRef.current = false;
      pausedRef.current = false;

      const AudioContextCtor =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor || !AudioContextCtor.prototype.audioWorklet) {
        const message = "This browser doesn't support the Web Audio Worklet API needed for live capture.";
        setStatus("error");
        setError(message);
        onErrorRef.current?.(message);
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not access the microphone.";
        setStatus("error");
        setError(message);
        onErrorRef.current?.(message);
        return;
      }

      streamRef.current = stream;

      const audioContext = new AudioContextCtor();
      audioContextRef.current = audioContext;
      sampleRateRef.current = audioContext.sampleRate;
      const source = audioContext.createMediaStreamSource(stream);

      startLevelMonitor(audioContext, source);

      try {
        await audioContext.audioWorklet.addModule("/audio-capture-worklet.js");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not load the audio capture worklet.";
        setStatus("error");
        setError(message);
        onErrorRef.current?.(message);
        cleanupMedia();
        return;
      }

      const workletNode = new AudioWorkletNode(audioContext, "capture-processor");
      workletNode.port.onmessage = handleWorkletMessage;
      source.connect(workletNode);
      // The worklet never writes to its outputs (it only reports samples back
      // over the port), so without a path toward destination some engines
      // may stop pulling it for lack of downstream consumers. A muted gain
      // keeps it in the active graph without anything audible looping back.
      const silentSink = audioContext.createGain();
      silentSink.gain.value = 0;
      workletNode.connect(silentSink).connect(audioContext.destination);
      workletNodeRef.current = workletNode;

      const ws = new WebSocket(deriveWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "init", meetingId }));
      };

      ws.onmessage = (event) => {
        let parsed: LiveServerEvent;
        try {
          parsed = JSON.parse(event.data as string) as LiveServerEvent;
        } catch {
          return;
        }
        if (parsed.type === "STATUS" && parsed.stage === "ready") {
          setStatus("streaming");
          setElapsedSeconds(0);
          elapsedTimerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
          resetSegmentBuffer();
          capturingRef.current = true;
        }
        onEventRef.current(parsed);
      };

      ws.onerror = () => {
        const message = "Live connection to the backend failed.";
        setStatus("error");
        setError(message);
        onErrorRef.current?.(message);
      };

      ws.onclose = () => {
        if (!stoppedRef.current) {
          stoppedRef.current = true;
          cleanupMedia();
          setStatus("stopped");
        }
      };
    },
    [startLevelMonitor, handleWorkletMessage, resetSegmentBuffer, cleanupMedia]
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    capturingRef.current = false;
    cutSegment(false, MIN_FLUSH_MS); // flush whatever's left — nothing follows, so no overlap to carry
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
    const ws = wsRef.current;
    setTimeout(() => ws?.close(), 400); // give the stop message + last segment a moment to flush
    cleanupMedia();
    setStatus("stopped");
  }, [cutSegment, cleanupMedia]);

  const togglePause = useCallback(() => {
    if (stoppedRef.current) return;
    if (pausedRef.current) {
      pausedRef.current = false;
      setStatus("streaming");
      resetSegmentBuffer();
      capturingRef.current = true;
    } else {
      pausedRef.current = true;
      setStatus("paused");
      capturingRef.current = false;
      cutSegment(false, MIN_FLUSH_MS); // flush the in-progress segment; nothing follows immediately while paused
    }
  }, [cutSegment, resetSegmentBuffer]);

  const reset = useCallback(() => {
    stoppedRef.current = true;
    pausedRef.current = false;
    cleanupMedia();
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("idle");
    setAudioLevel(0);
    setElapsedSeconds(0);
    setError(null);
  }, [cleanupMedia]);

  useEffect(() => reset, [reset]);

  return { status, audioLevel, elapsedSeconds, error, start, stop, togglePause, reset };
}
