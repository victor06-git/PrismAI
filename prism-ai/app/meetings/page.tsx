"use client";

import { Mic, Pause, Play, RotateCcw, Square } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { useRealtimeMeeting } from "@/hooks/useRealtimeMeeting";

function clock(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function MeetingsPage() {
  const meeting = useRealtimeMeeting();
  const active = meeting.phase === "connecting" || meeting.phase === "listening";

  return (
    <AppShell>
      <TopBar title="Live meeting" subtitle="Micrófono real · OpenAI Realtime · un solo análisis y como máximo una imagen Fal por reunión" />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <section className="rounded-2xl border border-prisma-border bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-prisma-muted">Estado</p>
              <h2 className="mt-1 font-serif text-2xl text-prisma-text">
                {meeting.phase === "idle" && "Lista para grabar"}
                {meeting.phase === "connecting" && "Conectando de forma segura…"}
                {meeting.phase === "listening" && (meeting.paused ? "En pausa" : "Escuchando en directo")}
                {meeting.phase === "processing" && "Creando entregables reales…"}
                {meeting.phase === "review" && "Reunión procesada"}
                {meeting.phase === "error" && "Hay que revisar la configuración"}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {active && <span className="font-mono text-sm text-prisma-muted">{clock(meeting.elapsed)}</span>}
              {meeting.phase === "idle" || meeting.phase === "error" ? (
                <button onClick={() => void meeting.start()} className="inline-flex items-center gap-2 rounded-xl bg-prisma-text px-4 py-2.5 text-sm text-white"><Mic className="h-4 w-4" /> Grabar</button>
              ) : active ? (
                <>
                  <button onClick={meeting.togglePause} disabled={meeting.phase === "connecting"} className="rounded-xl border border-prisma-border p-2.5 disabled:opacity-40" aria-label={meeting.paused ? "Continuar" : "Pausar"}>{meeting.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
                  <button onClick={() => void meeting.stop()} className="inline-flex items-center gap-2 rounded-xl bg-prisma-text px-4 py-2.5 text-sm text-white"><Square className="h-4 w-4" /> Finalizar</button>
                </>
              ) : meeting.phase === "review" ? (
                <button onClick={meeting.reset} className="inline-flex items-center gap-2 rounded-xl border border-prisma-border px-4 py-2.5 text-sm"><RotateCcw className="h-4 w-4" /> Nueva reunión</button>
              ) : null}
            </div>
          </div>
          {active && <div className="mt-5 h-2 overflow-hidden rounded-full bg-prisma-canvas"><div className="h-full rounded-full bg-prisma-accent transition-[width] duration-75" style={{ width: `${Math.max(3, meeting.audioLevel * 100)}%` }} /></div>}
          {meeting.error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{meeting.error}</p>}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="min-h-72 rounded-2xl border border-prisma-border bg-white p-5">
            <h3 className="font-medium text-prisma-text">Transcripción live</h3>
            <div className="mt-4 space-y-3 text-sm leading-relaxed">
              {meeting.lines.map((line, index) => <p key={`${index}-${line.slice(0, 12)}`}><span className="mr-2 font-mono text-xs text-prisma-muted">{index + 1}</span>{line}</p>)}
              {meeting.partial && <p className="text-prisma-muted">{meeting.partial}<span className="animate-pulse">▍</span></p>}
              {!meeting.lines.length && !meeting.partial && <p className="text-prisma-muted">La voz aparecerá aquí mientras hablas.</p>}
            </div>
          </section>

          <section className="min-h-72 rounded-2xl border border-prisma-border bg-white p-5">
            <h3 className="font-medium text-prisma-text">Resumen</h3>
            <p className="mt-4 text-sm leading-relaxed text-prisma-muted">{meeting.result?.summary ?? "Se generará una sola vez al finalizar para ahorrar tokens."}</p>
            {meeting.result?.dataInsights.map((insight) => <div key={insight.id} className="mt-4 rounded-xl bg-prisma-canvas p-3"><p className="text-sm font-medium">{insight.metricTarget}</p><p className="mt-1 text-xs text-prisma-muted">{insight.question}</p><p className="mt-2 text-xs">Dato: {insight.value}</p></div>)}
          </section>
        </div>

        {meeting.result && <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-prisma-border bg-white p-5">
            <h3 className="font-medium">Tickets ({meeting.result.tickets.length})</h3>
            <div className="mt-4 space-y-3">{meeting.result.tickets.map((ticket) => <article key={ticket.id} className="rounded-xl border border-prisma-border p-3"><div className="flex justify-between gap-3"><p className="text-sm font-medium">{ticket.title}</p><span className="text-xs text-prisma-muted">{ticket.storyPoints} pts</span></div><p className="mt-1 text-xs text-prisma-muted">{ticket.tag} · {ticket.priority}</p></article>)}</div>
          </section>
          <section className="rounded-2xl border border-prisma-border bg-white p-5">
            <h3 className="font-medium">Moodboard (máximo 1 generación)</h3>
            {meeting.result.visualAssets[0]?.imageUrl ? <img src={meeting.result.visualAssets[0].imageUrl} alt={meeting.result.visualAssets[0].assetName} className="mt-4 aspect-video w-full rounded-xl object-cover" /> : <p className="mt-4 text-sm text-prisma-muted">No se generó imagen; revisa FAL_KEY o la idea visual de la reunión.</p>}
          </section>
        </div>}
      </div>
    </AppShell>
  );
}
