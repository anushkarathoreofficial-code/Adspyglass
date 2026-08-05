import type { CountItem, SpyAd, SpyResult } from "./types";
import { daysBetween } from "./score";
import { fetchCategoryAds, type RawSpyAd } from "./adlibrary";

export const SUGGESTIONS = ["ex back", "cheating", "divorce", "marriage", "soulmate", "astrology", "career", "skeptic"];

function tally(values: string[]): CountItem[] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function toAd(a: RawSpyAd): SpyAd {
  return {
    brand: a.brand,
    libraryId: a.libraryId,
    snapshotUrl: `https://www.facebook.com/ads/library/?id=${a.libraryId}`,
    startDate: a.startDate,
    daysActive: daysBetween(a.startDate, null),
    mediaType: a.mediaType,
    format: a.format,
    hook: a.hook.replace(/^[\s"'“”]+|[\s"'“”]+$/g, "").length ? a.hook : `${a.mediaType === "video" ? "Video" : "Image"} ad — no caption`,
    angle: a.angle,
    cta: a.cta,
    funnel: a.funnel,
    categories: a.categories,
    mediaUrl: a.mediaUrl,
  };
}

/**
 * Free-text category search. Pulls ads via the live provider (real-time) or the
 * harvested corpus fallback, then computes SpyGlass-style aggregations.
 * @param force bypass the 7h auto-sync cache (manual "Sync now").
 */
export async function spySearch(query: string, force = false, cursor?: string, country = "US"): Promise<SpyResult> {
  const q = query.trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);

  const fetched = await fetchCategoryAds(query, force, cursor, country);

  // Corpus is the whole set → filter locally. Provider results are already
  // query-scoped, so keep them as-is.
  let pool = fetched.ads;
  if (fetched.source === "corpus" && q) {
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tokenRes = tokens.map((t) => new RegExp(`\\b${esc(t)}\\b`, "i"));
    const phraseRe = new RegExp(`\\b${esc(q)}\\b`, "i");
    pool = pool.filter((a) => {
      const hay = `${a.categories.join(" ")} ${a.hook} ${a.angle} ${a.brand} ${a.format} ${a.funnel} ${a.body ?? ""}`;
      return phraseRe.test(hay) || tokenRes.some((re) => re.test(hay));
    });
  }

  const ads = pool
    .map(toAd)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()); // oldest first = proven

  return {
    query,
    count: ads.length,
    totalCorpus: fetched.ads.length,
    ads,
    angleLeaderboard: tally(ads.map((a) => a.angle)),
    formatMix: tally(ads.map((a) => a.format)),
    funnelMix: tally(ads.map((a) => a.funnel)),
    ctaMix: tally(ads.map((a) => a.cta)),
    mediaMix: tally(ads.map((a) => a.mediaType)),
    suggestions: SUGGESTIONS,
    source: fetched.source,
    live: fetched.live,
    cached: fetched.cached,
    fetchedAt: fetched.fetchedAt,
    nextSyncAt: fetched.nextSyncAt,
    note: fetched.note,
    cursor: fetched.cursor,
    country: (country || "US").toUpperCase(),
  };
}
