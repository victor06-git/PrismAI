"use client";

import {
  Search,
  Bell,
  HelpCircle,
  Plus,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  variant?: "default" | "hero";
}

export function TopBar({
  title,
  subtitle,
  actions,
  variant = "default",
}: TopBarProps) {
  if (variant === "hero") {
    return (
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-medium">{title}</h1>
            {subtitle && (
              <p className="text-sm text-blue-100 mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <TopBarUtilities />
          </div>
        </div>
      </div>
    );
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-base font-medium text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-xs text-gray-500">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <TopBarUtilities compact />
      </div>
    </header>
  );
}

function TopBarUtilities({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {!compact && (
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tickets, meetings..."
            className="w-64 h-9 pl-9 pr-12 rounded-lg border border-gray-200 bg-gray-50 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-0.5 text-[10px] text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>
      )}
      <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors relative">
        <Bell className="h-4 w-4" />
        <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
      </button>
      <button className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
        <HelpCircle className="h-4 w-4" />
      </button>
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-medium text-white ml-1">
        HG
      </div>
    </div>
  );
}

export function CreateButton({
  onClick,
  label = "Create",
}: {
  onClick?: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors",
        "bg-white text-blue-700 hover:bg-blue-50 border border-white/20",
      )}
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  );
}

export function PrimaryButton({
  onClick,
  label,
  icon: Icon,
  disabled = false,
  variant = "primary",
}: {
  onClick?: () => void;
  label: string;
  icon?: typeof Plus;
  disabled?: boolean;
  variant?: "primary" | "danger" | "ghost";
}) {
  const variants = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost:
      "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}
