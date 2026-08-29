"use client";

import { useEffect, useRef, useState } from "react";

interface MetricsStreamProps {
  listening: boolean;
}

interface MetricSection {
  id: string;
  title: string;
  body: string[];
}

interface StreamedSection {
  id: string;
  title: string;
  lines: string[];
  titleComplete: boolean;
}

const metricSections: MetricSection[] = [
  {
    id: "objective",
    title: "Project objective",
    body: [
      "Build the global Grand Theft Auto VI marketing campaign to maximize pre-launch hype, pre-orders, and social reach, with Vice City as the visual and tonal centerpiece.",
    ],
  },
  {
    id: "decisions",
    title: "Decisions made",
    body: [
      "Trailer 2 sets the official campaign tone: cinematic, saturated, and set in Leonida.",
      "Lucia is the primary face of communications; Jason appears as the criminal duo counterpart.",
      "Priority channels: YouTube, TikTok, Twitch, and Instagram Reels.",
      "Story spoiler embargo until 72 hours after the trailer drop.",
      "Rockstar Newswire is the only official source for dates and editions.",
    ],
  },
  {
    id: "fr",
    title: "Functional requirements",
    body: [
      "Campaign hub with trailers, wallpapers, soundtrack snippets, and pre-order CTAs.",
      "Editorial calendar of short teasers (15–30s) adapted per network.",
      "Editions landing for Standard / Deluxe / Collector with a clear comparison.",
      "Digital press kit for verified media and creators.",
      "Tracking for views, shares, sentiment, and pre-order conversion by channel.",
    ],
  },
  {
    id: "nfr",
    title: "Non-functional requirements",
    body: [
      "Visual identity consistent with the Vice City / Leonida universe across all assets.",
      "Embargo and asset security: no leaks before official windows.",
      "Copy and subtitle localization for key markets (EN, ES, PT-BR, FR, DE, JP).",
      "Campaign hub load time under 2s on desktop and mobile.",
      "Partner creators must sign an NDA before receiving builds or exclusive clips.",
    ],
  },
  {
    id: "epics",
    title: "Epics",
    body: [
      "Trailer & cinematic drops",
      "Social hype engine (TikTok / Reels / Shorts)",
      "Pre-order & editions funnel",
      "Creator & media seeding program",
      "Live countdown & launch day war room",
    ],
  },
  {
    id: "stories",
    title: "User stories",
    body: [
      "As a fan, I want to watch the new trailer on loop with local subtitles so I can share it instantly.",
      "As a creator, I want an embargoed clip pack with clear publishing guidelines.",
      "As a buyer, I want to compare editions and pre-order in fewer than three clicks.",
      "As a community manager, I want a real-time sentiment dashboard on drop day.",
    ],
  },
  {
    id: "tasks",
    title: "Tasks",
    body: [
      "Finalize Trailer 2 cut and Dolby Atmos audio master.",
      "Edit vertical teasers of Lucia / Jason / Vice City nightlife.",
      "Publish Newswire with launch window date and pre-order links.",
      "Brief top 50 global creators with staggered embargos.",
      "Activate launch war room: social listening + crisis playbook.",
    ],
  },
  {
    id: "priorities",
    title: "Priorities",
    body: [
      "Critical — Trailer 2 drop and global sync",
      "Critical — Asset security / anti-leak",
      "High — Pre-order funnel and editions",
      "High — Creator seeding and media kit",
      "Medium — Vice City merch capsule (phase 2)",
    ],
  },
  {
    id: "dependencies",
    title: "Dependencies",
    body: [
      "Social drop depends on legal approval of the final trailer.",
      "Storefront pre-orders require SKUs confirmed by Take-Two.",
      "Creators do not receive clips until NDAs and embargos are closed.",
      "Localization blocks simultaneous publishing in non-EN markets.",
      "Launch war room needs access to YouTube and TikTok Ads analytics.",
    ],
  },
  {
    id: "risks",
    title: "Risks",
    body: [
      "Trailer or gameplay leak before the official embargo.",
      "Poorly communicated launch date expectations create backlash.",
      "Spoiler saturation on Twitch/TikTok dilutes drop impact.",
      "Toxic comparisons with GTA V / Online can misalign the message.",
      "Reputational crisis if a creator breaks the embargo.",
    ],
  },
  {
    id: "questions",
    title: "Open questions",
    body: [
      "Do we confirm the exact launch window in the next Newswire?",
      "Does Lucia carry 70% share of voice or a 50/50 split with Jason?",
      "Is there an embargoed gameplay demo for tier-1 creators?",
      "What paid media budget remains for drop week?",
      "Does physical merch land in Sprint 2 or move post-launch?",
    ],
  },
  {
    id: "sprint1",
    title: "Sprint 1",
    body: [
      "Lock Trailer 2 + subtitles and end-cards by region.",
      "Vertical teasers and publishing grid for 72h pre-drop.",
      "Campaign hub v1 with wishlist / pre-order CTA.",
      "Onboard tier-1 creators and send NDA media kit.",
    ],
  },
  {
    id: "sprint2",
    title: "Sprint 2",
    body: [
      "Global Trailer 2 drop with paid + organic amplification.",
      "Optimize pre-order funnel by country conversion.",
      "Second wave of clips (gameplay teaser / Leonida world tour).",
      "Launch day war room: monitoring, official replies, and crisis response.",
    ],
  },
];

function wordsOf(text: string) {
  return text.split(/\s+/).filter(Boolean);
}

export function MetricsStream({ listening }: MetricsStreamProps) {
  const [sections, setSections] = useState<StreamedSection[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef({
    sectionIndex: 0,
    lineIndex: -1,
    wordIndex: 0,
  });

  useEffect(() => {
    if (!listening) return;

    let cancelled = false;
    let timeout = 0;

    const schedule = (ms: number, fn: () => void) => {
      timeout = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    };

    const tick = () => {
      const progress = progressRef.current;
      if (progress.sectionIndex >= metricSections.length) return;

      const source = metricSections[progress.sectionIndex];
      const typingTitle = progress.lineIndex < 0;
      const sourceText = typingTitle
        ? source.title
        : source.body[progress.lineIndex];
      const words = wordsOf(sourceText);

      if (progress.wordIndex === 0) {
        const firstWord = words[0] ?? "";

        if (typingTitle) {
          setSections((current) => [
            ...current,
            {
              id: source.id,
              title: firstWord,
              lines: [],
              titleComplete: false,
            },
          ]);
        } else {
          setSections((current) => {
            const next = [...current];
            const last = next[next.length - 1];
            if (!last) return current;
            next[next.length - 1] = {
              ...last,
              lines: [...last.lines, firstWord],
            };
            return next;
          });
        }

        progress.wordIndex = 1;
      } else {
        progress.wordIndex += 1;
        const displayed = words.slice(0, progress.wordIndex).join(" ");

        setSections((current) => {
          const next = [...current];
          const last = next[next.length - 1];
          if (!last) return current;

          if (typingTitle) {
            next[next.length - 1] = { ...last, title: displayed };
          } else {
            const lines = [...last.lines];
            lines[lines.length - 1] = displayed;
            next[next.length - 1] = { ...last, lines };
          }

          return next;
        });
      }

      if (progress.wordIndex >= words.length) {
        if (typingTitle) {
          setSections((current) => {
            const next = [...current];
            const last = next[next.length - 1];
            if (!last) return current;
            next[next.length - 1] = { ...last, titleComplete: true };
            return next;
          });
          progress.lineIndex = 0;
          progress.wordIndex = 0;
          schedule(320, tick);
          return;
        }

        if (progress.lineIndex >= source.body.length - 1) {
          progress.sectionIndex += 1;
          progress.lineIndex = -1;
          progress.wordIndex = 0;
          schedule(720, tick);
          return;
        }

        progress.lineIndex += 1;
        progress.wordIndex = 0;
        schedule(280, tick);
        return;
      }

      schedule(72, tick);
    };

    schedule(480, tick);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [listening]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [sections]);

  const lastSection = sections[sections.length - 1];
  const source = metricSections[progressRef.current.sectionIndex];
  const typing =
    listening &&
    Boolean(lastSection) &&
    Boolean(source) &&
    progressRef.current.sectionIndex < metricSections.length;

  const showCaretOnTitle =
    typing &&
    lastSection &&
    !lastSection.titleComplete &&
    progressRef.current.lineIndex < 0;

  const showCaretOnLine =
    typing &&
    lastSection &&
    lastSection.titleComplete &&
    progressRef.current.lineIndex >= 0;

  return (
    <div
      ref={scrollRef}
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-8 py-8"
    >
      {sections.length === 0 ? (
        <p className="font-serif text-lg tracking-tight text-prisma-muted">
          Listening for campaign signals…
          {listening && (
            <span className="ml-0.5 inline-block h-4 w-px translate-y-[2px] animate-pulse bg-prisma-muted align-middle" />
          )}
        </p>
      ) : (
        sections.map((section, sectionIndex) => {
          const isLast = sectionIndex === sections.length - 1;

          return (
            <section key={section.id}>
              <h3 className="font-serif text-lg font-semibold leading-snug tracking-tight text-prisma-text">
                {section.title}
                {isLast && showCaretOnTitle && (
                  <span className="ml-0.5 inline-block h-4 w-px translate-y-[2px] animate-pulse bg-prisma-text align-middle" />
                )}
              </h3>
              {section.lines.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {section.lines.map((line, lineIndex) => {
                    const isTypingLine =
                      isLast &&
                      showCaretOnLine &&
                      lineIndex === section.lines.length - 1;

                    return (
                      <li
                        key={`${section.id}-${lineIndex}`}
                        className="text-sm leading-relaxed text-prisma-muted"
                      >
                        {line}
                        {isTypingLine && (
                          <span className="ml-0.5 inline-block h-3 w-px translate-y-[1px] animate-pulse bg-prisma-muted align-middle" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
