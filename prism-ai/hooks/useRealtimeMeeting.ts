"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

export interface MeetingResult {
  summary: string;
  tickets: Array<{ id: string; title: string; tag: string; priority: string; storyPoints: number; acceptanceCriteria: string[] }>;
  visualAssets: Array<{ assetName: string; falPrompt: string; imageUrl?: string }>;
  dataInsights: Array<{ id: string; question: string; metricTarget: string; value: string; trend: string; summary: string }>;
}

type Phase = "idle" | "connecting" | "listening" | "processing" | "review" | "error";

export function useRealtimeMeeting() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRef = useRef<number | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const linesRef = useRef<string[]>([]);
  const partialsRef = useRef(new Map<string, string>());

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    pcRef.current?.close();
    void contextRef.current?.close().catch(() => undefined);
    timerRef.current = null;
    frameRef.current = null;
    streamRef.current = null;
    pcRef.current = null;
    channelRef.current = null;
    contextRef.current = null;
    setAudioLevel(0);
  }, []);

  const monitorLevel = useCallback((stream: MediaStream) => {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);
    contextRef.current = context;
    const samples = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length);
      setAudioLevel(Math.min(1, rms * 4));
      frameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const start = useCallback(async () => {
    cleanup();
    setError(null);
    setResult(null);
    setLines([]);
    linesRef.current = [];
    partialsRef.current.clear();
    setPartial("");
    setElapsed(0);
    setPaused(false);
    setPhase("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      monitorLevel(stream);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
      const channel = pc.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onmessage = (message) => {
        const event = JSON.parse(message.data as string) as { type?: string; item_id?: string; delta?: string; transcript?: string; error?: { message?: string } };
        const itemId = event.item_id ?? "current";
        if (event.type === "conversation.item.input_audio_transcription.delta") {
          const next = `${partialsRef.current.get(itemId) ?? ""}${event.delta ?? ""}`;
          partialsRef.current.set(itemId, next);
          setPartial(next);
        } else if (event.type === "conversation.item.input_audio_transcription.completed") {
          const text = (event.transcript ?? partialsRef.current.get(itemId) ?? "").trim();
          partialsRef.current.delete(itemId);
          setPartial("");
          if (text) {
            linesRef.current = [...linesRef.current, text];
            setLines(linesRef.current);
          }
        } else if (event.type === "error") {
          setError(event.error?.message ?? "Live transcription failed.");
        }
      };
      channel.onopen = () => {
        setPhase("listening");
        timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
      };

      const tokenResponse = await fetch(`${API_URL}/api/realtime/token`, { method: "POST" });
      if (!tokenResponse.ok) throw new Error((await tokenResponse.json().catch(() => null))?.detail ?? "Could not authorize OpenAI Realtime.");
      const tokenData = (await tokenResponse.json()) as { value?: string; client_secret?: { value?: string } };
      const ephemeralKey = tokenData.value ?? tokenData.client_secret?.value;
      if (!ephemeralKey) throw new Error("OpenAI did not return a temporary Realtime credential.");

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });
      if (!response.ok) throw new Error(`OpenAI Realtime connection failed (${response.status}).`);
      await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
    } catch (cause) {
      cleanup();
      setPhase("error");
      setError(cause instanceof Error ? cause.message : "Could not access the microphone.");
    }
  }, [cleanup, monitorLevel]);

  const stop = useCallback(async () => {
    if (channelRef.current?.readyState === "open") {
      channelRef.current.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      // Give OpenAI a brief window to emit the final completed transcript.
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    const transcript = [...linesRef.current, ...partialsRef.current.values()].join(" ").trim();
    cleanup();
    if (!transcript) {
      setPhase("error");
      setError("No se detectó voz. Habla unos segundos antes de finalizar.");
      return;
    }
    setPhase("processing");
    try {
      const response = await fetch(`${API_URL}/api/process-meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail ?? "Meeting analysis failed.");
      const analysis = (await response.json()) as MeetingResult;

      // Show the useful text result immediately. Image generation is slower
      // and must never block the summary/tickets portion of the demo.
      setResult(analysis);
      setPhase("review");

      // Hackathon cost guard: at most one Fal image per completed meeting.
      if (analysis.visualAssets[0]) {
        try {
          const visualResponse = await fetch(`${API_URL}/api/generate-asset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meetingId: crypto.randomUUID(), prompt: analysis.visualAssets[0].falPrompt }),
          });
          if (visualResponse.ok) {
            const { imageUrl } = (await visualResponse.json()) as { imageUrl: string };
            setResult((current) => current ? {
              ...current,
              visualAssets: current.visualAssets.map((asset, index) => index === 0 ? { ...asset, imageUrl } : asset),
            } : current);
          }
        } catch {
          // The summary and tickets remain usable when the optional visual fails.
        }
      }
    } catch (cause) {
      setPhase("error");
      setError(cause instanceof Error ? cause.message : "Meeting analysis failed.");
    }
  }, [cleanup]);

  const togglePause = useCallback(() => {
    const next = !paused;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setPaused(next);
  }, [paused]);

  const reset = useCallback(() => {
    cleanup();
    linesRef.current = [];
    partialsRef.current.clear();
    setLines([]); setPartial(""); setResult(null); setError(null); setElapsed(0); setPaused(false); setPhase("idle");
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);
  return { phase, lines, partial, elapsed, paused, result, error, audioLevel, start, stop, togglePause, reset };
}
