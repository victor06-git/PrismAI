"use client";

import {
  Home,
  Video,
  Ticket,
  Kanban,
  Image,
  BarChart3,
  Users,
  Inbox,
  UserCheck,
  Flag,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/data/appConfig";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
  badge?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: "Product",
    items: [
      { label: "Home", href: "/", icon: Home },
      { label: "Meetings", href: "/meetings", icon: Video },
      { label: "Tickets", href: "/tickets", icon: Ticket },
      { label: "Sprint", href: "/sprint", icon: Kanban },
      { label: "Moodboard", href: "/moodboard", icon: Image },
      { label: "Data Intelligence", href: "/data", icon: BarChart3 },
      { label: "Team", href: "/team", icon: Users },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Backlog", href: "/backlog", icon: Inbox },
      { label: "Assigned to me", href: "/assigned", icon: UserCheck },
      { label: "Priorities", href: "/priorities", icon: Flag },
      { label: "Activity", href: "/activity", icon: Activity },
    ],
  },
  {
    title: "Workspace",
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-prisma-border bg-prisma-canvas transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[240px]",
      )}
    >
      <div className="flex h-16 items-center border-b border-prisma-border px-4">
        {!collapsed ? (
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-prisma-accent-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-prisma-accent" />
            </div>
            <span className="font-serif text-lg tracking-tight text-prisma-text">
              {PRODUCT_NAME}
            </span>
          </Link>
        ) : (
          <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-prisma-accent-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-prisma-accent" />
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-5">
        {navigation.map((section) => (
          <div key={section.title ?? "default"} className="mb-6">
            {section.title && !collapsed && (
              <p className="mb-2 px-3 text-[11px] font-medium tracking-wide text-prisma-muted">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-prisma-accent-soft text-prisma-text"
                          : "text-prisma-muted hover:bg-white/70 hover:text-prisma-text",
                        collapsed && "justify-center px-2",
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0 stroke-[1.5]" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span className="rounded-full border border-prisma-border bg-white px-1.5 py-0.5 text-[10px] text-prisma-muted">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-prisma-border p-2">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center rounded-xl py-2.5 text-prisma-muted transition-colors hover:bg-white/70 hover:text-prisma-text"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 stroke-[1.5]" />
          ) : (
            <>
              <ChevronLeft className="mr-2 h-4 w-4 stroke-[1.5]" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
