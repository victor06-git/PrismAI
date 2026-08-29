"use client";

import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  className?: string;
  variant?: "text" | "card" | "avatar" | "row";
}

export function LoadingSkeleton({
  className,
  variant = "text",
}: LoadingSkeletonProps) {
  const variants = {
    text: "h-4 w-full rounded",
    card: "h-32 w-full rounded-xl",
    avatar: "h-8 w-8 rounded-full",
    row: "h-12 w-full rounded-lg",
  };

  return (
    <div
      className={cn(
        "animate-pulse bg-gray-100",
        variants[variant],
        className,
      )}
    />
  );
}

export function LoadingSkeletonGroup({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton key={i} variant="row" />
      ))}
    </div>
  );
}
