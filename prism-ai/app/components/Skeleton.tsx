import { clsx } from "clsx";

/** A pulsing placeholder bar/block — used while a panel's data hasn't arrived yet. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx("animate-skeleton rounded-md bg-zinc-200 dark:bg-zinc-800", className)}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}
