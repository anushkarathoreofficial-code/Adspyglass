import type { ResearchSource, TopicResearch } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export function hasGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function empty(topic: string, source: TopicResearch["source"], note: string): TopicResearch {
  return {
    source,
    topic,
    summary: "",
    trendingPains: [],
    phrases: [],
    questions: [],
    angles: [],
    sources: [],
    note,
  };
}

const PROMPT = (topic: string) => `You are an ad-strategy researcher. Research what is trending RIGHT NOW (2026) around the topic "${topic}" as it relates to US consumers who might be marketed to.

Use web search. Prioritise Reddit threads, Quora questions, and recent articles. Capture the real, current voice of people — not generic marketing speak.

Return ONLY a JSON object (no markdown fences) with these keys:
{
  "summary": "2-3 sentence read on what's trending in this topic right now",
  "trendingPains": ["specific pain points people are voicing now", "..."],
  "phrases": ["exact phrases/wording real people use (Reddit/Quora voice)", "..."],
  "questions": ["top questions people are asking about this topic", "..."],
  "angles": ["ad/creative angles that would resonate with this audience right now", "..."]
}
Give 4-6 items per array. Be specific and current, grounded in what you find.`;

interface GeminiPart { text?: string }
interface GeminiChunk { web?: { uri?: string; title?: string } }
interface GeminiResp {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    groundingMetadata?: { groundingChunks?: GeminiChunk[] };
  }[];
  error?: { message?: string };
}

function parseJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 8) : [];
}

/** Realtime topic research via Gemini + Google Search grounding. */
export async function researchTopic(topic: string): Promise<TopicResearch> {
  const q = topic.trim();
  if (!q) return empty(q, "unavailable", "Type a category to research.");
  if (!hasGemini()) {
    return empty(q, "unavailable", "Set GEMINI_API_KEY in .env.local to enable live Reddit/Quora/web research.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
    process.env.GEMINI_API_KEY!
  )}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT(q) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.4 },
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as GeminiResp;
    if (!res.ok || json.error) {
      return empty(q, "error", `Gemini error: ${json.error?.message ?? res.status}`);
    }
    const cand = json.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    const data = parseJson(text) ?? {};
    const sources: ResearchSource[] = (cand?.groundingMetadata?.groundingChunks ?? [])
      .map((c) => ({ title: c.web?.title ?? "", url: c.web?.uri ?? "" }))
      .filter((s) => s.url)
      .slice(0, 8);

    return {
      source: "gemini",
      topic: q,
      summary: typeof data.summary === "string" ? data.summary : "",
      trendingPains: strArr(data.trendingPains),
      phrases: strArr(data.phrases),
      questions: strArr(data.questions),
      angles: strArr(data.angles),
      sources,
    };
  } catch (e) {
    return empty(q, "error", e instanceof Error ? e.message : "Research request failed");
  }
}
