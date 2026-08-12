import { createHash } from "crypto";
import { rateLimit } from "./ratelimit";
import type { Platform, PlatformResult, Story } from "./types";

// Gemini usage is billed per-key, so it gets its own rate limits on top of the
// general per-IP limiter in the API routes:
//  - the SHARED server key (process.env.GEMINI_API_KEY, used by anyone who
//    hasn't supplied their own) is capped tightly and GLOBALLY, since every
//    call against it spends the app owner's budget, no matter which IP/user
//    triggers it.
//  - a client's OWN key (pasted into the 🔑 bar) is capped per-key, mainly to
//    stop a runaway loop/bug hammering it (and risking Gemini itself
//    throttling or flagging that key), not to protect the owner's spend.
const SHARED_KEY_MAX_PER_MIN = 15;
const OWN_KEY_MAX_PER_MIN = 30;
const MINUTE_MS = 60_000;

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/** A client-supplied key (from the browser's localStorage) takes priority over the server env var. */
export function hasGemini(clientKey?: string): boolean {
  return Boolean(clientKey || process.env.GEMINI_API_KEY);
}

function emptyResult(topic: string, platform: Platform, source: PlatformResult["source"], note: string): PlatformResult {
  return { source, platform, topic, stories: [], note };
}

const SCOPE: Record<Platform, string> = {
  reddit:
    'Focus specifically on Reddit. Use web search with queries like "site:reddit.com <topic>" and close variants to find real Reddit threads and comments.',
  quora:
    'Focus specifically on Quora. Use web search with queries like "site:quora.com <topic>" and close variants to find real Quora questions and answers.',
  web:
    "Focus on the general web — news articles, blogs, and forums — EXCLUDING reddit.com and quora.com (those platforms are researched separately). Use plain web search queries about the topic.",
};

const PLATFORM_LABEL: Record<Platform, string> = { reddit: "Reddit", quora: "Quora", web: "the web" };

const URL_RULE: Record<Platform, string> = {
  reddit:
    'STRICT RULE: every "url" MUST be a direct link to an actual reddit.com (or redd.it) thread, post, or comment page. Never link to an article, blog, or any other site that merely discusses or cites Reddit — the link itself must open on reddit.com.',
  quora:
    'STRICT RULE: every "url" MUST be a direct link to an actual quora.com question or answer page. Never link to an article, blog, or any other site that merely discusses or cites Quora — the link itself must open on quora.com.',
  web:
    'STRICT RULE: every "url" must be a real news article, blog post, or forum page — and must NOT be a reddit.com, redd.it, or quora.com link (those platforms are covered by their own tabs).',
};

const PROMPT = (topic: string, platform: Platform, shuffle: boolean) => `You are an ad-strategy researcher. ${SCOPE[platform]}

Find real, specific stories/threads/posts about "${topic}" on ${PLATFORM_LABEL[platform]} that a US audience is currently engaging with — genuine results you found via search, not invented ones.
${URL_RULE[platform]}
${shuffle ? "IMPORTANT: the user already saw the most obvious top hits. Dig deeper and surface a DIFFERENT set of real stories this time — less obvious threads, older or newer ones, different angles — not the same handful you'd return by default." : ""}

Return ONLY a JSON object (no markdown fences) with this shape:
{
  "stories": [
    { "title": "the real title of the post/thread/article", "summary": "1-2 sentence gist of what it says or why it's relevant", "url": "the real URL to it, obeying the STRICT RULE above", "source": "e.g. r/AskWomen, Quora, or the site name" }
  ]
}
Find up to 8 real candidates (a domain filter will keep only the valid ones, so extras help). Titles and URLs must be real results from your search, not fabricated. If you can't find 8 genuine on-platform results, return fewer rather than inventing any.`;

interface GeminiPart { text?: string }
interface GeminiResp {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
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

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Enforce that a story's link actually opens on the platform it claims to be from. */
const DOMAIN_OK: Record<Platform, (host: string) => boolean> = {
  reddit: (h) => h === "redd.it" || h === "reddit.com" || h.endsWith(".reddit.com"),
  quora: (h) => h === "quora.com" || h.endsWith(".quora.com"),
  web: (h) => !(h === "redd.it" || h === "reddit.com" || h.endsWith(".reddit.com") || h === "quora.com" || h.endsWith(".quora.com")),
};

function toStories(v: unknown, platform: Platform): Story[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      title: typeof x.title === "string" ? x.title : "",
      summary: typeof x.summary === "string" ? x.summary : "",
      url: typeof x.url === "string" ? x.url : "",
      source: typeof x.source === "string" ? x.source : "",
    }))
    .filter((s) => s.title && s.url)
    .filter((s) => {
      const host = hostnameOf(s.url);
      return host !== null && DOMAIN_OK[platform](host);
    })
    .slice(0, 5);
}

/**
 * Top-5 real stories for a topic on one platform (Reddit / Quora / Web), via Gemini +
 * Google Search grounding. Pass shuffle=true to nudge the model toward a fresh set.
 * @param clientKey optional key from the browser's localStorage — takes priority over
 *   the server's GEMINI_API_KEY when present.
 */
export async function fetchStories(topic: string, platform: Platform, clientKey?: string, shuffle = false): Promise<PlatformResult> {
  const q = topic.trim();
  if (!q) return emptyResult(q, platform, "unavailable", "Type a category to see top stories.");
  const apiKey = clientKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return emptyResult(
      q,
      platform,
      "unavailable",
      "Add a Gemini API key below (stored only in your browser) to see live stories."
    );
  }

  const usingSharedKey = !clientKey;
  const rl = usingSharedKey
    ? rateLimit("gemini:shared", SHARED_KEY_MAX_PER_MIN, MINUTE_MS)
    : rateLimit(`gemini:key:${hashKey(apiKey)}`, OWN_KEY_MAX_PER_MIN, MINUTE_MS);
  if (!rl.ok) {
    return emptyResult(
      q,
      platform,
      "unavailable",
      usingSharedKey
        ? `The shared Gemini key has hit its usage limit — add your own key in the 🔑 bar above, or try again in ${rl.retryAfter}s.`
        : `You're sending requests too fast with this key — try again in ${rl.retryAfter}s.`
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT(q, platform, shuffle) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: shuffle ? 0.9 : 0.5 },
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as GeminiResp;
    if (!res.ok || json.error) {
      return emptyResult(q, platform, "error", `Gemini error: ${json.error?.message ?? res.status}`);
    }
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    const data = parseJson(text) ?? {};
    return { source: "gemini", platform, topic: q, stories: toStories(data.stories, platform) };
  } catch (e) {
    return emptyResult(q, platform, "error", e instanceof Error ? e.message : "Request failed");
  }
}
