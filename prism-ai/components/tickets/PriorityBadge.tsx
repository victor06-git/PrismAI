import { cn } from "@/lib/utils";
import type { TicketPriority } from "@/types";

interface PriorityBadgeProps {
  priority: TicketPriority;
  size?: "sm" | "md";
}

const config: Record<
  TicketPriority,
  { label: string; className: string }
> = {
  critical: {
    label: "Critical",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  high: {
    label: "High",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  medium: {
    label: "Medium",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  low: {
    label: "Low",
    className: "bg-gray-50 text-gray-600 border-gray-200",
  },
};

export function PriorityBadge({ priority, size = "sm" }: PriorityBadgeProps) {
  const { label, className } = config[priority];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-medium uppercase tracking-wide",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        className,
      )}
    >
      {label}
    </span>
  );
}
