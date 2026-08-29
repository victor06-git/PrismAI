import { Suspense } from "react";
import { InboxWorkspace } from "@/components/inbox/InboxWorkspace";

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxWorkspace />
    </Suspense>
  );
}
