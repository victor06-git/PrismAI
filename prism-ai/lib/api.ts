const API_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

export interface CalaResult {
  name?: string;
  headquarters?: string;
  industry?: string;
}

export async function generateVisual(
  prompt: string,
  meetingId = "demo-1",
) {
  const response = await fetch(`${API_URL}/api/generate-asset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      meetingId,
      prompt,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to generate visual");
  }

  return (await response.json()) as {
    imageUrl: string;
  };
}

export async function getCalaInsights(
  transcript: string,
  meetingId = "demo-1",
) {
  const response = await fetch(`${API_URL}/api/data-insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      meetingId,
      transcript,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to retrieve Cala insights");
  }

  return (await response.json()) as {
    results: CalaResult[];
    entities: unknown[];
  };
}
