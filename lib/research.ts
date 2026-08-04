import type { PlatformFindings, ResearchSource, TopicResearch } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/** A client-supplied key (from the browser's localStorage) takes priority over the server env var. */
export function hasGemini(clientKey?: string): boolean {
  return Boolean(clientKey || process.env.GEMINI_API_KEY);
}

type Platform = "reddit" | "quora" | "web";

function emptyPlatform(note?: string): PlatformFindings {
  return { summary: "", painPoints: [], phrases: [], questions: [], angles: [], sources: [], note };
}

function emptyResult(topic: string, source: TopicResearch["source"], note: string): TopicResearch {
  return { source, topic, reddit: emptyPlatform(), quora: emptyPlatform(), web: emptyPlatform(), note };
}

const SCOPE: Record<Platform, string> = {
  reddit:
    'Focus specifically on Reddit. Use web search with queries like "site:reddit.com <topic>" and close variants to find real Reddit threads and comments.',
  quora:
    'Focus specifically on Quora. Use web search with queries like "site:quora.com <topic>" and close variants to find real Quora questions and answers.',
  web:
    "Focus on the general web — news articles, blogs, and forums — EXCLUDING reddit.com and quora.com (those platforms are researched separately). Use plain web search queries about the topic.",
};

const PROMPT = (topic: string, platform: Platform) => `You are an ad-strategy researcher. ${SCOPE[platform]}

Research what is trending RIGHT NOW (2026) around the topic "${topic}" as it relates to US consumers who might be marketed to. Capture the real, current voice of people on this platform — not generic marketing speak.

Return ONLY a JSON object (no markdown fences) with these keys:
{
  "summary": "2-3 sentence read on what's trending in this topic on this platform right now, based on what you actually found",
  "painPoints": ["specific pain points people are voicing now", "..."],
  "phrases": ["exact phrases/wording real people use", "..."],
  "questions": ["top questions people are asking about this topic", "..."],
  "angles": ["ad/creative angles that would resonate with this audience right now", "..."]
}
Give 3-5 items per array. Be specific and current, grounded in what you actually found. If you found nothing substantive on this platform for this topic, return short or empty arrays rather than inventing content.`;

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
  return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 6) : [];
}

/** Fetch one platform's findings. Never throws — a failure here shouldn't sink the other two. */
async function fetchPlatform(topic: string, platform: Platform, apiKey: string): Promise<PlatformFindings> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT(topic, platform) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.4 },
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as GeminiResp;
    if (!res.ok || json.error) {
      return emptyPlatform(`Gemini error: ${json.error?.message ?? res.status}`);
    }
    const cand = json.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    const data = parseJson(text) ?? {};
    const sources: ResearchSource[] = (cand?.groundingMetadata?.groundingChunks ?? [])
      .map((c) => ({ title: c.web?.title ?? "", url: c.web?.uri ?? "" }))
      .filter((s) => s.url)
      .slice(0, 6);

    return {
      summary: typeof data.summary === "string" ? data.summary : "",
      painPoints: strArr(data.painPoints),
      phrases: strArr(data.phrases),
      questions: strArr(data.questions),
      angles: strArr(data.angles),
      sources,
    };
  } catch (e) {
    return emptyPlatform(e instanceof Error ? e.message : "Request failed");
  }
}

/**
 * Realtime topic research via Gemini + Google Search grounding, split into Reddit / Quora / Web.
 * @param clientKey optional key supplied by the browser (stored in its own localStorage, sent as a
 *   per-request header) — takes priority over the server's GEMINI_API_KEY when present.
 */
export async function researchTopic(topic: string, clientKey?: string): Promise<TopicResearch> {
  const q = topic.trim();
  if (!q) return emptyResult(q, "unavailable", "Type a category to research.");
  const apiKey = clientKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return emptyResult(
      q,
      "unavailable",
      "Add a Gemini API key below (stored only in your browser) to enable live Reddit/Quora/web research."
    );
  }

  try {
    const [reddit, quora, web] = await Promise.all([
      fetchPlatform(q, "reddit", apiKey),
      fetchPlatform(q, "quora", apiKey),
      fetchPlatform(q, "web", apiKey),
    ]);
    return { source: "gemini", topic: q, reddit, quora, web };
  } catch (e) {
    return emptyResult(q, "error", e instanceof Error ? e.message : "Research request failed");
  }
}
