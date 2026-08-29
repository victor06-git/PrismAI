"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { ToastContainer } from "@/components/ui/Toast";

interface AppShellProps {
  children: React.ReactNode;
  toasts?: Array<{
    id: string;
    title: string;
    description?: string;
    type: "success" | "info" | "warning" | "error";
  }>;
  onDismissToast?: (id: string) => void;
}

export function AppShell({ children, toasts = [], onDismissToast }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-prisma-canvas">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      {onDismissToast && (
        <ToastContainer toasts={toasts} onDismiss={onDismissToast} />
      )}
    </div>
  );
}
