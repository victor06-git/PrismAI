/** Canned transcript for one-click demoing without needing a real recording on hand. */
export const SAMPLE_TRANSCRIPT = `Product sync — Q3 onboarding revamp

Priya (PM): Our activation rate is stuck around 40%. Signup is the biggest drop-off point —
too many required fields, and the error states are confusing. Let's simplify the form and
add inline validation.

Diego (Design): Agreed. I also want to refresh the visual identity for the whole welcome flow —
right now it feels generic. I'm thinking a warmer palette, some custom illustrations for the
empty states, and a hero moodboard we can pitch to marketing this week.

Sam (Eng): On the backend side we need a proper /onboarding/progress endpoint so the frontend
can resume users where they left off, plus event tracking on every step so we can actually see
where people bail. Also, our staging environment is still manual — we should automate deploys
before we ship any of this.

Priya: Good call. Once that's live I want a dashboard tracking completion rate, step-2 drop-off,
and time-to-first-value so we can tell if any of this actually moved the needle.`;
