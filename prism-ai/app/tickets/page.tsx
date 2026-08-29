"use client";

import { PlaceholderPage, ContentCard } from "@/components/layout/PlaceholderPage";
import { Ticket as TicketIcon } from "lucide-react";

export default function TicketsPage() {
  return (
    <PlaceholderPage
      title="Tickets"
      subtitle="All Jira-style tickets generated from meetings and manual creation."
      icon={<TicketIcon className="h-7 w-7 text-gray-400" />}
    >
      <ContentCard title="Recent Tickets" />
    </PlaceholderPage>
  );
}
