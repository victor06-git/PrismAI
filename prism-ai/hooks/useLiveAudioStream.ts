"use client";

/**
 * Drives the WebSocket /ws/live progressive pipeline: real microphone level
 * (AudioContext + AnalyserNode) for the waveform bar, plus a segment-restart
 * MediaRecorder loop that streams ~4s audio files to the backend and
 * forwards every typed event it sends back (TRANSCRIPT_UPDATE, NEW_TICKET,
 * MOODBOARD_IMAGE, CALA_METRIC, STATUS, ERROR) to the caller.
 *
 * Chunking trade-off (see backend/audio/live_session.py for the full
 * rationale): each segment is produced by stopping and immediately
 * restarting MediaRecorder on the same stream, because only the *first*
 * chunk of a `timeslice`-based recording is an independently-decodable
 * file — later ones aren't. That keeps every segment transcribable, at the
 * honest cost that a word spoken exactly across a ~4s boundary can be
 * split. Eliminating that entirely needs OpenAI's separate Realtime API.
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

const SEGMENT_DURATION_MS = 4000;
const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function deriveWsUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "http://localhost:8000";
  return base.replace(/^http/, "ws") + "/ws/live";
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
  const levelFrameRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");
  const pausedRef = useRef(false);
  const stoppedRef = useRef(true);

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

  const startLevelMonitor = useCallback((stream: MediaStream) => {
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    audioContextRef.current = audioContext;
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

  const cleanupMedia = useCallback(() => {
    stopLevelMonitor();
    if (elapsedTimerRef.current !== null) clearInterval(elapsedTimerRef.current);
    if (segmentTimerRef.current !== null) clearTimeout(segmentTimerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close().catch(() => {});
    elapsedTimerRef.current = null;
    segmentTimerRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, [stopLevelMonitor]);

  const sendSegment = useCallback((blob: Blob) => {
    if (blob.size === 0 || wsRef.current?.readyState !== WebSocket.OPEN) return;
    void blob.arrayBuffer().then((buffer) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(buffer);
    });
  }, []);

  // Indirection so the recursive "start the next segment" call inside
  // onstop always reaches the latest closure via a stable ref, instead of
  // startSegmentLoop referencing itself directly (which the React Compiler
  // flags — a self-referencing useCallback can't safely memoize).
  const startSegmentLoopRef = useRef<() => void>(() => {});

  const startSegmentLoop = useCallback(() => {
    if (pausedRef.current || stoppedRef.current || !streamRef.current) return;

    const mimeType = pickMimeType();
    mimeTypeRef.current = mimeType ?? "audio/webm";
    const recorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      sendSegment(new Blob(chunks, { type: mimeTypeRef.current }));
      if (!pausedRef.current && !stoppedRef.current) {
        startSegmentLoopRef.current(); // gapless-as-possible: start the next segment right away
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    segmentTimerRef.current = setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, SEGMENT_DURATION_MS);
  }, [sendSegment]);

  useEffect(() => {
    startSegmentLoopRef.current = startSegmentLoop;
  }, [startSegmentLoop]);

  const start = useCallback(
    async (meetingId?: string) => {
      setError(null);
      setStatus("connecting");
      stoppedRef.current = false;
      pausedRef.current = false;

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
      startLevelMonitor(stream);

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
          startSegmentLoop();
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
    [startLevelMonitor, startSegmentLoop, cleanupMedia]
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (segmentTimerRef.current !== null) clearTimeout(segmentTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
    const ws = wsRef.current;
    setTimeout(() => ws?.close(), 400); // give the stop message + last segment a moment to flush
    cleanupMedia();
    setStatus("stopped");
  }, [cleanupMedia]);

  const togglePause = useCallback(() => {
    if (stoppedRef.current) return;
    if (pausedRef.current) {
      pausedRef.current = false;
      setStatus("streaming");
      startSegmentLoop();
    } else {
      pausedRef.current = true;
      setStatus("paused");
      if (segmentTimerRef.current !== null) clearTimeout(segmentTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop(); // flushes the in-progress segment; onstop won't restart while paused
      }
    }
  }, [startSegmentLoop]);

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
