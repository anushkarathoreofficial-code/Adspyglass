// Batch translation to English for foreign-market ad copy, so the user can
// understand ads pulled from non-English countries (Germany, India, etc.).
//
// Uses Google's free translate endpoint (no key required). It's an unofficial
// endpoint, so every call is wrapped to FAIL SOFT — on any error a given text
// just comes back untranslated rather than breaking the response.

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

interface TranslateResult {
  translations: { original: string; translated: string }[];
  to: string;
}

async function translateOne(text: string, to: string): Promise<string> {
  const t = text.trim();
  if (!t) return text;
  try {
    const url = `${ENDPOINT}?client=gtx&sl=auto&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(t.slice(0, 1200))}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return text;
    // Response shape: [[[ "translated chunk", "orig chunk", ... ], ...], ...]
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[0])) return text;
    const chunks = (data[0] as unknown[])
      .map((seg) => (Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : ""))
      .join("");
    return chunks.trim() || text;
  } catch {
    return text;
  }
}

/** Translate a batch of short texts to `to` (default English). Order preserved. */
export async function translateBatch(texts: string[], to = "en"): Promise<TranslateResult> {
  const capped = texts.slice(0, 40); // safety bound
  const translated = await Promise.all(capped.map((x) => translateOne(x, to)));
  return {
    to,
    translations: capped.map((original, i) => ({ original, translated: translated[i] })),
  };
}
