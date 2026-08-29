"use client";

import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { cn } from "@/lib/utils";

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
}

export function PlaceholderPage({
  title,
  subtitle,
  icon,
  children,
}: PlaceholderPageProps) {
  return (
    <AppShell>
      <TopBar title={title} subtitle={subtitle} />
      <div className="flex-1 overflow-y-auto p-6">
        {children ?? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              {icon}
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">{title}</h2>
            <p className="text-sm text-gray-500 max-w-md">{subtitle}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export function StatGrid({
  stats,
}: {
  stats: Array<{ label: string; value: string; change?: string }>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <p className="text-xs text-gray-500">{stat.label}</p>
          <p className="text-2xl font-medium text-gray-900 mt-1">{stat.value}</p>
          {stat.change && (
            <p className="text-xs text-emerald-600 mt-1">{stat.change}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function ContentCard({
  title,
  children,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-200 bg-white overflow-hidden",
        className,
      )}
    >
      <div className="px-5 py-4">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      </div>
      {children ? <div className="p-5 pt-0">{children}</div> : null}
    </div>
  );
}
