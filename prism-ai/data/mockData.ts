import type {
  AiInsight,
  CreativeConcept,
  KpiInsight,
  SprintItem,
  TeamMember,
  Ticket,
  TranscriptLine,
} from "@/types";

export const PRODUCT_NAME = "FlowJira AI";

export const teamMembers: TeamMember[] = [
  {
    id: "1",
    name: "Sarah Chen",
    role: "Product Lead",
    avatar: "SC",
    color: "#6366F1",
  },
  {
    id: "2",
    name: "Marcus Webb",
    role: "Engineering",
    avatar: "MW",
    color: "#0EA5E9",
  },
  {
    id: "3",
    name: "Elena Rodriguez",
    role: "Design",
    avatar: "ER",
    color: "#EC4899",
  },
  {
    id: "4",
    name: "James Park",
    role: "Marketing",
    avatar: "JP",
    color: "#10B981",
  },
  {
    id: "5",
    name: "Aisha Patel",
    role: "Data Analytics",
    avatar: "AP",
    color: "#F59E0B",
  },
];

export const demoTranscript: TranscriptLine[] = [
  {
    id: "t1",
    speaker: "Sarah Chen",
    text: "Alright team, let's kick off the Q3 mobile app GTM sprint planning. Our launch target is September 15th.",
    timestamp: "00:00",
    highlight: "decision",
  },
  {
    id: "t2",
    speaker: "Marcus Webb",
    text: "We need to finalize the push notification system before launch. Currently it's blocking the onboarding flow.",
    timestamp: "00:12",
    highlight: "task",
  },
  {
    id: "t3",
    speaker: "Elena Rodriguez",
    text: "I'll create updated onboarding screens with the new brand palette — soft blues and clean whites, very premium feel.",
    timestamp: "00:28",
    highlight: "design",
  },
  {
    id: "t4",
    speaker: "James Park",
    text: "Marketing needs the App Store assets by next Friday. We should also prepare a launch email sequence.",
    timestamp: "00:45",
    highlight: "task",
  },
  {
    id: "t5",
    speaker: "Aisha Patel",
    text: "What's our current Day-7 retention rate? We need at least 42% to hit our Q3 OKR for mobile engagement.",
    timestamp: "01:02",
    highlight: "kpi",
  },
  {
    id: "t6",
    speaker: "Sarah Chen",
    text: "Marcus, can you own the push notification epic? Elena handles onboarding redesign. James, you're on launch assets.",
    timestamp: "01:18",
    highlight: "decision",
  },
  {
    id: "t7",
    speaker: "Marcus Webb",
    text: "I'll break the push notification work into three stories: permission prompt, deep linking, and analytics tracking.",
    timestamp: "01:35",
    highlight: "task",
  },
  {
    id: "t8",
    speaker: "Elena Rodriguez",
    text: "For the moodboard, I'm thinking minimalist SaaS aesthetic — think Linear meets Notion with subtle gradients.",
    timestamp: "01:52",
    highlight: "design",
  },
  {
    id: "t9",
    speaker: "Aisha Patel",
    text: "We should also track conversion from onboarding to first action. Current funnel drop-off is 34% at step 3.",
    timestamp: "02:08",
    highlight: "kpi",
  },
  {
    id: "t10",
    speaker: "Sarah Chen",
    text: "Let's assign critical priority to push notifications and onboarding. Marketing assets are high priority for this sprint.",
    timestamp: "02:25",
    highlight: "decision",
  },
];

export const demoTickets: Ticket[] = [
  {
    id: "tk1",
    key: "MOB-101",
    summary: "Implement push notification permission flow",
    description:
      "Build native permission prompt with fallback for denied state. Include re-prompt strategy after 7 days.",
    status: "in_progress",
    priority: "critical",
    type: "story",
    assignee: teamMembers[1],
    labels: ["mobile", "notifications", "launch-blocker"],
    storyPoints: 8,
    sprint: "Sprint 24",
    createdAt: "Just now",
  },
  {
    id: "tk2",
    key: "MOB-102",
    summary: "Push notification deep linking",
    description:
      "Configure deep links for notification taps to route users to relevant in-app screens.",
    status: "todo",
    priority: "critical",
    type: "story",
    assignee: teamMembers[1],
    labels: ["mobile", "deep-linking"],
    storyPoints: 5,
    sprint: "Sprint 24",
    createdAt: "Just now",
  },
  {
    id: "tk3",
    key: "MOB-103",
    summary: "Notification analytics tracking",
    description:
      "Track delivery, open rates, and conversion from notification to in-app action.",
    status: "todo",
    priority: "high",
    type: "task",
    assignee: teamMembers[1],
    labels: ["analytics", "notifications"],
    storyPoints: 3,
    sprint: "Sprint 24",
    createdAt: "Just now",
  },
  {
    id: "tk4",
    key: "DES-201",
    summary: "Redesign onboarding screens with new brand palette",
    description:
      "Update onboarding flow with soft blues, clean whites, premium SaaS aesthetic. 4 screens total.",
    status: "in_progress",
    priority: "critical",
    type: "story",
    assignee: teamMembers[2],
    labels: ["design", "onboarding", "brand"],
    storyPoints: 5,
    sprint: "Sprint 24",
    createdAt: "Just now",
  },
  {
    id: "tk5",
    key: "MKT-301",
    summary: "Prepare App Store launch assets",
    description:
      "Screenshots, preview video, and metadata for iOS and Android store listings. Due next Friday.",
    status: "todo",
    priority: "high",
    type: "task",
    assignee: teamMembers[3],
    labels: ["marketing", "launch", "app-store"],
    storyPoints: 3,
    sprint: "Sprint 24",
    createdAt: "Just now",
  },
  {
    id: "tk6",
    key: "MKT-302",
    summary: "Launch email sequence",
    description:
      "3-email drip campaign: teaser, launch day, and feature highlight. Include A/B test variants.",
    status: "todo",
    priority: "high",
    type: "task",
    assignee: teamMembers[3],
    labels: ["marketing", "email", "launch"],
    storyPoints: 2,
    sprint: "Sprint 24",
    createdAt: "Just now",
  },
];

export const demoInsights: AiInsight[] = [
  {
    id: "i1",
    type: "decision",
    text: "Q3 mobile app GTM launch target: September 15th",
    confidence: 0.97,
  },
  {
    id: "i2",
    type: "task",
    text: "Push notification system blocking onboarding flow — needs resolution",
    confidence: 0.94,
  },
  {
    id: "i3",
    type: "owner",
    text: "Marcus Webb assigned to push notification epic",
    confidence: 0.96,
  },
  {
    id: "i4",
    type: "owner",
    text: "Elena Rodriguez assigned to onboarding redesign",
    confidence: 0.95,
  },
  {
    id: "i5",
    type: "owner",
    text: "James Park assigned to launch assets & email sequence",
    confidence: 0.93,
  },
  {
    id: "i6",
    type: "priority",
    text: "Critical: Push notifications & onboarding redesign",
    confidence: 0.91,
  },
  {
    id: "i7",
    type: "requirement",
    text: "App Store assets required by next Friday",
    confidence: 0.89,
  },
  {
    id: "i8",
    type: "requirement",
    text: "Day-7 retention target: 42% for Q3 OKR",
    confidence: 0.88,
  },
];

export const demoCreativeConcepts: CreativeConcept[] = [
  {
    id: "c1",
    title: "Premium SaaS Onboarding",
    description:
      "Minimalist flow with soft blue gradients, generous whitespace, and subtle micro-interactions",
    tags: ["onboarding", "brand", "mobile"],
    gradient: "from-blue-50 via-indigo-50 to-violet-50",
    icon: "palette",
  },
  {
    id: "c2",
    title: "Linear × Notion Aesthetic",
    description:
      "Clean typography, thin borders, calm neutral palette with accent highlights for CTAs",
    tags: ["moodboard", "design-system"],
    gradient: "from-gray-50 via-slate-50 to-zinc-100",
    icon: "layout",
  },
  {
    id: "c3",
    title: "Launch Campaign Visual",
    description:
      "Hero imagery with device mockups, gradient overlays, and bold product messaging",
    tags: ["marketing", "launch"],
    gradient: "from-emerald-50 via-teal-50 to-cyan-50",
    icon: "rocket",
  },
  {
    id: "c4",
    title: "Notification UX Patterns",
    description:
      "Permission prompt designs with clear value proposition and graceful denial handling",
    tags: ["notifications", "ux"],
    gradient: "from-amber-50 via-orange-50 to-rose-50",
    icon: "bell",
  },
];

export const demoKpiInsights: KpiInsight[] = [
  {
    id: "k1",
    question: "What is our current Day-7 retention rate?",
    metric: "Day-7 Retention",
    trend: "down",
    value: "38.2%",
    context: "Target is 42% for Q3 OKR — 3.8pp gap to close before launch",
    priority: "high",
  },
  {
    id: "k2",
    question: "Where is the onboarding funnel dropping off?",
    metric: "Onboarding Funnel",
    trend: "down",
    value: "34% drop",
    context: "Step 3 of onboarding has highest abandonment — redesign priority",
    priority: "high",
  },
  {
    id: "k3",
    question: "What's the push notification opt-in rate?",
    metric: "Notification Opt-in",
    trend: "neutral",
    value: "61%",
    context: "Industry benchmark is 65% — permission flow redesign may improve this",
    priority: "medium",
  },
  {
    id: "k4",
    question: "Launch readiness score across workstreams?",
    metric: "Launch Readiness",
    trend: "up",
    value: "67%",
    context: "Engineering 72%, Design 65%, Marketing 58% — marketing is lagging",
    priority: "medium",
  },
];

export const demoSprints: SprintItem[] = [
  {
    id: "s1",
    name: "Sprint 24 — Mobile GTM Launch",
    ticketCount: 6,
    progress: 12,
    startDate: "Aug 26",
    endDate: "Sep 9",
  },
  {
    id: "s2",
    name: "Sprint 23 — Beta Stabilization",
    ticketCount: 14,
    progress: 100,
    startDate: "Aug 12",
    endDate: "Aug 25",
  },
];

export const demoTimeline = {
  transcriptDelay: 1800,
  insightDelay: 2500,
  ticketDelay: 3200,
  creativeDelay: 4500,
  kpiDelay: 5200,
};
