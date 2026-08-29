"use client";

/**
 * Manual test harness for /api/auth/* — click through the real flow in a
 * real browser against the real backend. Not part of the PrismAI product UI;
 * this is the "in real life, not like a test" counterpart to
 * backend/scripts/verify_auth.py and backend/tests/test_auth_flow.py.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "http://localhost:8000";
const AUTH = `${API_BASE_URL}/api/auth`;

interface LogEntry {
  id: number;
  ok: boolean;
  text: string;
  timestamp: string;
}

interface RegisteredUser {
  user_id: string;
  email: string;
  name: string;
}

interface QRSession {
  session_id: string;
  nonce: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default function AuthTestPage() {
  // useId() gives a stable, render-pure unique suffix (Date.now()/Math.random()
  // would be impure and risk a server/client hydration mismatch).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [email, setEmail] = useState(`dev.tester+${uid}@prismai.dev`);
  const [name, setName] = useState("Dev Tester");
  const [user, setUser] = useState<RegisteredUser | null>(null);
  const [session, setSession] = useState<QRSession | null>(null);
  const [pollStatus, setPollStatus] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const logIdRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pushLog = useCallback((ok: boolean, text: string) => {
    logIdRef.current += 1;
    setLog((prev) => [{ id: logIdRef.current, ok, text, timestamp: new Date().toLocaleTimeString() }, ...prev]);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const startPolling = useCallback(
    (sessionId: string) => {
      pollTimerRef.current = setInterval(async () => {
        try {
          const response = await fetch(`${AUTH}/qr-session/poll?sessionId=${encodeURIComponent(sessionId)}`);
          const body = await response.json();
          if (!response.ok) {
            pushLog(false, `GET /qr-session/poll -> ${response.status}: ${body.detail}`);
            stopPolling();
            return;
          }
          setPollStatus(body.status);
          if (body.status === "APPROVED") {
            setAccessToken(body.access_token);
            pushLog(true, "GET /qr-session/poll -> 200: APPROVED, token issued");
            stopPolling();
          } else if (body.status === "EXPIRED") {
            pushLog(false, "GET /qr-session/poll -> 200: EXPIRED");
            stopPolling();
          }
        } catch (err) {
          pushLog(false, `GET /qr-session/poll -> network error: ${String(err)}`);
          stopPolling();
        }
      }, 1500);
    },
    [pushLog, stopPolling]
  );

  async function handleRegister() {
    try {
      const response = await fetch(`${AUTH}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const body = await response.json();
      if (!response.ok) {
        pushLog(false, `POST /register -> ${response.status}: ${body.detail}`);
        return;
      }
      setUser(body);
      pushLog(true, `POST /register -> 201: user_id=${body.user_id}`);
    } catch (err) {
      pushLog(false, `POST /register -> network error: ${String(err)}`);
    }
  }

  async function handleCreateSession() {
    stopPolling();
    setPollStatus(null);
    setAccessToken(null);
    try {
      const response = await fetch(`${AUTH}/qr-session/create`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        pushLog(false, `POST /qr-session/create -> ${response.status}: ${body.detail}`);
        return;
      }
      setSession(body);
      setPollStatus(body.status);
      pushLog(true, `POST /qr-session/create -> 201: session_id=${body.session_id}`);
      startPolling(body.session_id);
    } catch (err) {
      pushLog(false, `POST /qr-session/create -> network error: ${String(err)}`);
    }
  }

  async function handleSimulateScan() {
    if (!user || !session) return;
    try {
      const response = await fetch(`${AUTH}/qr-session/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.session_id, nonce: session.nonce, user_id: user.user_id }),
      });
      const body = await response.json();
      if (!response.ok) {
        pushLog(false, `POST /qr-session/scan -> ${response.status}: ${body.detail}`);
        return;
      }
      pushLog(true, `POST /qr-session/scan -> 200: status=${body.status}`);
    } catch (err) {
      pushLog(false, `POST /qr-session/scan -> network error: ${String(err)}`);
    }
  }

  const decoded = accessToken ? decodeJwtPayload(accessToken) : null;
  const statusColor =
    pollStatus === "APPROVED" ? "text-emerald-600" : pollStatus === "EXPIRED" ? "text-red-600" : "text-amber-600";

  return (
    <div className="mx-auto max-w-3xl p-6 font-mono text-sm text-zinc-900 dark:text-zinc-100">
      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        ⚠️ Developer testing page — exercises <code>/api/auth/*</code> directly against{" "}
        <code>{API_BASE_URL}</code>. Not part of the PrismAI product UI.
      </div>

      <h1 className="mb-4 text-lg font-bold">Auth flow — manual test harness</h1>

      <section className="mb-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 font-semibold">1. Register</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-[220px] flex-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="email"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-40 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="name"
          />
          <button
            onClick={handleRegister}
            className="rounded bg-zinc-900 px-3 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Register
          </button>
        </div>
        {user && <p className="mt-2 text-xs text-zinc-500">user_id: {user.user_id}</p>}
      </section>

      <section className="mb-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 font-semibold">2. QR session</h2>
        <div className="flex gap-2">
          <button
            onClick={handleCreateSession}
            className="rounded bg-zinc-900 px-3 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Create QR session
          </button>
          <button
            onClick={handleSimulateScan}
            disabled={!user || !session}
            className="rounded bg-violet-600 px-3 py-1 text-white disabled:opacity-40"
          >
            Simulate mobile scan
          </button>
        </div>
        {session && (
          <div className="mt-2 space-y-1 break-all text-xs text-zinc-500">
            <p>session_id: {session.session_id}</p>
            <p>nonce: {session.nonce}</p>
            <p>
              status: <span className={statusColor}>{pollStatus}</span>
            </p>
          </div>
        )}
      </section>

      {accessToken && (
        <section className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <h2 className="mb-2 font-semibold text-emerald-700 dark:text-emerald-300">3. Access token issued</h2>
          <p className="break-all text-xs">{accessToken}</p>
          {decoded && (
            <pre className="mt-2 overflow-x-auto text-xs text-zinc-500">{JSON.stringify(decoded, null, 2)}</pre>
          )}
        </section>
      )}

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 font-semibold">Request log</h2>
        <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
          {log.length === 0 && <p className="text-zinc-400">Nothing yet — click a button above.</p>}
          {log.map((entry) => (
            <p key={entry.id} className={entry.ok ? "text-emerald-600" : "text-red-600"}>
              [{entry.timestamp}] {entry.ok ? "✔" : "✘"} {entry.text}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
