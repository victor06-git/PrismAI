"use client";

import { useRouter } from "next/navigation";
import { Mic } from "lucide-react";

export function Dashboard() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-prisma-canvas px-8">
      <div className="flex flex-col items-center gap-6">
        <button
          type="button"
          onClick={() => router.push("/inbox")}
          aria-label="Press to start"
          className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-prisma-text text-white transition-colors hover:bg-[#3a3a3a] focus:outline-none focus-visible:ring-2 focus-visible:ring-prisma-accent focus-visible:ring-offset-2 focus-visible:ring-offset-prisma-canvas md:h-28 md:w-28"
        >
          <Mic className="h-9 w-9 md:h-10 md:w-10" strokeWidth={1.5} />
        </button>
        <p className="font-serif text-3xl leading-snug tracking-tight text-prisma-text md:text-4xl">
          Press to start
        </p>
      </div>
    </div>
  );
}
