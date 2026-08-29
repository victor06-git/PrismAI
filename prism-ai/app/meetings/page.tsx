"use client";

import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";

export default function MeetingsPage() {
  return (
    <AppShell>
      <TopBar title="Meetings" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          <SectionTitle title="Transcript" />
          <SectionTitle title="Context" />
          <SectionTitle title="Sprint" />
          <SectionTitle title="Moodboard" />
          <SectionTitle title="KPI insights" />
        </div>
      </div>
    </AppShell>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-prisma-border bg-white px-5 py-4">
      <h3 className="text-sm font-medium text-prisma-text">{title}</h3>
    </div>
  );
}
