"""
Static fallback/demo data for PrismAI.

Used when OpenAI / Fal.ai / Cala calls fail (rate limit, missing API key,
network issues, etc.) so the live demo never shows a broken screen. Shapes
match `schemas.ProcessMeetingResponse`, `schemas.GenerateAssetResponse` and
`schemas.DataInsightsResponse` exactly.
"""

# Shared between MOCK_PROCESS_MEETING_RESPONSE and MOCK_DATA_INSIGHTS_RESPONSE
# so the two endpoints stay consistent in a demo.
_SAMPLE_DATA_INSIGHTS: list[dict] = [
    {
        "id": "INS-1",
        "question": "Are new users completing onboarding?",
        "metricTarget": "Onboarding Completion Rate",
        "value": "61%",
        "trend": "up",
        "summary": "Completion rate climbed 8pts after simplifying the signup form last sprint.",
    },
    {
        "id": "INS-2",
        "question": "Where do users drop off during signup?",
        "metricTarget": "Step 2 Drop-off Rate",
        "value": "24%",
        "trend": "down",
        "summary": "Drop-off at the profile-details step decreased after removing optional fields.",
    },
    {
        "id": "INS-3",
        "question": "How fast do users reach activation?",
        "metricTarget": "Time to First Value",
        "value": "3m 40s",
        "trend": "flat",
        "summary": "Time to first value has held steady; next sprint should target the empty-state UX.",
    },
]

MOCK_PROCESS_MEETING_RESPONSE: dict = {
    "summary": (
        "The team reviewed the Q3 onboarding revamp. Priorities: simplify signup, "
        "refresh the visual identity for the welcome flow, and instrument activation "
        "metrics to catch drop-off earlier."
    ),
    "tickets": [
        {
            "id": "TCK-1",
            "title": "Rebuild signup form with inline validation",
            "tag": "Frontend",
            "priority": "High",
            "storyPoints": 5,
            "acceptanceCriteria": [
                "Given invalid email, when user blurs the field, then an inline error is shown",
                "Given all fields valid, when user submits, then the CTA shows a loading state",
                "Form is fully usable via keyboard and passes basic a11y checks",
            ],
        },
        {
            "id": "TCK-2",
            "title": "Expose /api/onboarding/progress endpoint",
            "tag": "Backend",
            "priority": "High",
            "storyPoints": 8,
            "acceptanceCriteria": [
                "Given a valid session, when the client requests progress, then the current step is returned",
                "Endpoint responds in under 200ms at p95",
                "Unauthorized requests return 401",
            ],
        },
        {
            "id": "TCK-3",
            "title": "Design new welcome-flow illustrations",
            "tag": "Design",
            "priority": "Medium",
            "storyPoints": 3,
            "acceptanceCriteria": [
                "Illustrations match the updated brand palette",
                "Assets exported in SVG and PNG @2x",
            ],
        },
        {
            "id": "TCK-4",
            "title": "Provision staging environment for onboarding service",
            "tag": "Infra",
            "priority": "Medium",
            "storyPoints": 5,
            "acceptanceCriteria": [
                "Staging deploys automatically on merge to main",
                "Environment variables are sourced from the secrets manager",
            ],
        },
        {
            "id": "TCK-5",
            "title": "Add drop-off event tracking to onboarding steps",
            "tag": "Backend",
            "priority": "Low",
            "storyPoints": 2,
            "acceptanceCriteria": [
                "Each onboarding step emits a `step_viewed` and `step_completed` event",
                "Events include anonymized user id and timestamp",
            ],
        },
    ],
    "visualAssets": [
        {
            "assetName": "Welcome Screen Moodboard",
            "falPrompt": (
                "Minimalist SaaS onboarding welcome screen, soft gradient background in "
                "violet and coral, friendly abstract shapes, clean sans-serif typography "
                "space, product screenshot mockup floating with soft shadow, modern "
                "startup aesthetic, high detail, 4k"
            ),
        },
        {
            "assetName": "Activation Dashboard Hero",
            "falPrompt": (
                "Futuristic analytics dashboard UI on a laptop screen, glowing data "
                "charts, dark mode interface with neon violet accents, isometric "
                "perspective, studio lighting, product photography style"
            ),
        },
    ],
    "dataInsights": _SAMPLE_DATA_INSIGHTS,
}

MOCK_GENERATE_ASSET_RESPONSE: dict = {
    "imageUrl": "https://placehold.co/1280x720/6d28d9/ffffff?text=PrismAI+Fallback+Asset",
}

MOCK_DATA_INSIGHTS_RESPONSE: dict = {
    "dataInsights": _SAMPLE_DATA_INSIGHTS,
}
