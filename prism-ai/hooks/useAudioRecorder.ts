"use client";

/**
 * Microphone recorder built on the browser's MediaRecorder API.
 *
 * Design note: OpenAI's whisper-1 REST endpoint transcribes one complete
 * audio file — it doesn't support incrementally transcribing partial chunks
 * mid-recording (that needs the separate Realtime API over a WebSocket,
 * which is a materially different integration). So "automatic chunk upload"
 * here means: record a full take, and the instant you stop, the complete
 * clip is handed to `onRecordingComplete` for upload — no manual "upload"
 * step. `audioLevel` (0..1, sampled via an AnalyserNode) drives a live
 * waveform-style visualization while recording.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "stopped" | "error";

export interface UseAudioRecorderResult {
  status: RecorderStatus;
  elapsedSeconds: number;
  /** 0..1 live input level, sampled ~60/s while recording — drive a waveform/meter with it. */
  audioLevel: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useAudioRecorder(
  onRecordingComplete: (blob: Blob, mimeType: string) => void,
  onError?: (message: string) => void
): UseAudioRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onRecordingCompleteRef.current = onRecordingComplete;
    onErrorRef.current = onError;
  }, [onRecordingComplete, onError]);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    if (timerRef.current !== null) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close().catch(() => {});
    animationFrameRef.current = null;
    timerRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  const monitorLevel = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
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
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      monitorLevel();

      const mimeType = pickMimeType();
      mimeTypeRef.current = mimeType ?? "audio/webm";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        cleanup();
        setStatus("stopped");
        onRecordingCompleteRef.current(blob, mimeTypeRef.current);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not access the microphone.";
      setStatus("error");
      setError(message);
      cleanup();
      onErrorRef.current?.(message);
    }
  }, [cleanup, monitorLevel]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setStatus("idle");
    setElapsedSeconds(0);
    setAudioLevel(0);
    setError(null);
    chunksRef.current = [];
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return { status, elapsedSeconds, audioLevel, error, start, stop, reset };
}
