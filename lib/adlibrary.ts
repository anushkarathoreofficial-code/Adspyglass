import corpus from "@/config/spy-corpus.json";
import corpusDE from "@/config/spy-corpus-de.json";

export interface RawSpyAd {
  brand: string;
  libraryId: string;
  startDate: string;
  mediaType: "video" | "image" | "carousel";
  format: string;
  funnel: string;
  cta: string;
  hook: string;
  angle: string;
  categories: string[];
  body?: string;
  /** direct video/image file when the provider exposes one (real Ad Library CDN URL) */
  mediaUrl?: string;
  /** brand-grouping fields (populated in live mode; used by the Astrology-brands tab) */
  pageId?: string;
  siteUrl?: string; // best destination link for the advertiser
  siteDomain?: string; // human-readable domain (e.g. blog.mediumchat.com)
  pageCategories?: string[];
}

export interface LiveFetch {
  ads: RawSpyAd[];
  source: "scrapecreators" | "corpus";
  live: boolean;
  fetchedAt: string; // ISO
  nextSyncAt: string; // ISO (fetchedAt + 7h)
  cached: boolean;
  note?: string;
  cursor?: string; // pagination cursor for the NEXT page (undefined = no more pages)
}

const SEVEN_HOURS = 7 * 60 * 60 * 1000;

/** Only allow http(s) media URLs — never let a javascript:/data: scheme reach an href. */
function safeHttpUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    const p = new URL(url);
    return p.protocol === "https:" || p.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

export function hasProvider(): boolean {
  return Boolean(process.env.SCRAPECREATORS_API_KEY);
}

// In-memory 7h cache, keyed by category query. Survives across requests within
// a running server; a fresh server or a `force` sync re-fetches.
const CACHE = new Map<string, { at: number; ads: RawSpyAd[]; cursor?: string }>();

function stamp(ads: RawSpyAd[], source: LiveFetch["source"], live: boolean, at: number, cached: boolean, note?: string, cursor?: string): LiveFetch {
  return {
    ads,
    source,
    live,
    fetchedAt: new Date(at).toISOString(),
    nextSyncAt: new Date(at + SEVEN_HOURS).toISOString(),
    cached,
    note,
    cursor,
  };
}

// --- light heuristic labelling for live ads (until enriched by Gemini) ------
function classify(text: string): { angle: string; funnel: string; categories: string[]; mediaHint: "video" | "image" } {
  const t = text.toLowerCase();
  const cats: string[] = [];
  const add = (re: RegExp, c: string) => { if (re.test(t)) cats.push(c); };
  add(/\bex\b|come back|move on|situationship|ghost/i, "ex back");
  add(/cheat|affair|suspicious|loyal/i, "cheating");
  add(/divorc|breakup|broke up|separat/i, "divorce");
  add(/marriage|soulmate|the one|right person|marry/i, "marriage");
  add(/career|job|money|business|purpose|direction/i, "career");
  add(/astrolog|zodiac|birth chart|horoscope|aura|tarot/i, "astrology");
  if (!cats.length) cats.push("general");
  const angle = /free|no[- ]risk|\$1|first (chat|3)/i.test(t) ? "Low-risk offer"
    : /didn'?t believe|skeptic|scam/i.test(t) ? "Skeptic-to-believer"
    : /\d[\d,]{2,}|reviews|rated|trustpilot/i.test(t) ? "Social proof"
    : /she (knew|nailed|told|said|revealed)|initials|name start/i.test(t) ? "Specificity as proof"
    : "Curiosity / emotional hook";
  const funnel = /quiz|take the|answer \d/i.test(t) ? "Quiz funnel"
    : /free (reading|chat)|first (chat|3)/i.test(t) ? "Free trial → app/chat"
    : /shop|buy|order/i.test(t) ? "Direct-to-PDP"
    : "App install / lead";
  return { angle, funnel, categories: cats, mediaHint: "video" };
}

interface ScrapeCreatorsAd {
  ad_archive_id?: string;
  ad_id?: string;
  page_name?: string;
  page_id?: string;
  start_date?: number | string;
  is_active?: boolean;
  snapshot?: {
    page_name?: string;
    cta_text?: string;
    body?: { text?: string };
    videos?: { video_hd_url?: string; video_sd_url?: string }[];
    images?: { original_image_url?: string; resized_image_url?: string }[];
    cards?: unknown[];
    caption?: string;
    link_url?: string;
    page_profile_uri?: string;
    page_categories?: unknown;
  };
}

/**
 * Fetch ads for a category, real-time, from the configured provider.
 * Falls back to the harvested corpus when no provider key is set.
 * Results are cached for 7h per category (the auto-sync window); pass force to bypass.
 */
export async function fetchCategoryAds(query: string, force = false, cursor?: string, country = "US"): Promise<LiveFetch> {
  const cc = (country || "US").toUpperCase();
  const key = `${cc}::${query.trim().toLowerCase() || "__all__"}::${cursor || "0"}`;
  const now = Date.now();

  // Per-country harvested fallback so e.g. Germany shows real German ads even
  // when the live provider is unavailable.
  const fallback = ((cc === "DE" ? corpusDE : corpus) as { ads: RawSpyAd[] }).ads;

  if (!hasProvider()) {
    // corpus mode: always "fresh" (static), but still stamped for the sync UI
    return stamp(fallback, "corpus", false, now, false,
      "Add SCRAPECREATORS_API_KEY to fetch live from the Ad Library. Showing harvested ads.");
  }

  // The provider needs a keyword — an empty query would 400. Show corpus quietly.
  if (!query.trim()) {
    return stamp(fallback, "corpus", false, now, false);
  }

  const hit = CACHE.get(key);
  if (!force && hit && now - hit.at < SEVEN_HOURS) {
    return stamp(hit.ads, "scrapecreators", true, hit.at, true, undefined, hit.cursor);
  }

  try {
    const url = `https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads?query=${encodeURIComponent(query)}&country=${encodeURIComponent(cc)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetch(url, {
      headers: { "x-api-key": process.env.SCRAPECREATORS_API_KEY! },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`provider ${res.status}`);
    const json = (await res.json()) as { success?: boolean; searchResults?: ScrapeCreatorsAd[]; cursor?: string };
    const rows = json.searchResults ?? [];
    const nextCursor = json.cursor || undefined;
    const ads: RawSpyAd[] = rows
      .filter((r) => r.is_active !== false)
      .map((r) => {
        const snap = r.snapshot ?? {};
        const text = snap.body?.text ?? "";
        const c = classify(text);
        const sd = r.start_date
          ? new Date(Number(r.start_date) * 1000).toISOString().slice(0, 10)
          : new Date(now).toISOString().slice(0, 10);
        const media: RawSpyAd["mediaType"] =
          snap.videos && snap.videos.length ? "video" : snap.cards && snap.cards.length > 1 ? "carousel" : "image";
        const mediaUrl = safeHttpUrl(
          snap.videos?.[0]?.video_hd_url ||
          snap.videos?.[0]?.video_sd_url ||
          snap.images?.[0]?.original_image_url ||
          snap.images?.[0]?.resized_image_url
        );
        const siteUrl = safeHttpUrl(snap.link_url) ||
          (snap.caption ? safeHttpUrl(`https://${snap.caption.replace(/^https?:\/\//, "")}`) : undefined) ||
          safeHttpUrl(snap.page_profile_uri);
        const pageCategories = Array.isArray(snap.page_categories)
          ? (snap.page_categories as unknown[]).filter((x): x is string => typeof x === "string")
          : undefined;
        return {
          brand: r.page_name ?? snap.page_name ?? "Unknown",
          libraryId: String(r.ad_archive_id ?? r.ad_id ?? ""),
          startDate: sd,
          mediaType: media,
          format: media === "video" ? "Video" : media === "carousel" ? "Carousel" : "Image / static",
          funnel: c.funnel,
          cta: snap.cta_text || "Learn More",
          hook: text.split(/[.!?\n]/)[0]?.slice(0, 140) || "(no text)",
          angle: c.angle,
          categories: c.categories,
          body: text,
          mediaUrl,
          pageId: r.page_id != null ? String(r.page_id) : undefined,
          siteUrl,
          siteDomain: snap.caption || undefined,
          pageCategories,
        };
      })
      .filter((a) => a.libraryId);

    // Advertisers run the same creative under many ad IDs — collapse duplicates
    // (same brand + same opening copy) so the list shows distinct ads, keeping
    // the first (oldest) instance.
    const seen = new Set<string>();
    const deduped = ads.filter((a) => {
      const dupKey = `${a.brand}::${(a.body || a.hook).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 100)}`;
      if (seen.has(dupKey)) return false;
      seen.add(dupKey);
      return true;
    });

    CACHE.set(key, { at: now, ads: deduped, cursor: nextCursor });
    return stamp(deduped, "scrapecreators", true, now, false, undefined, nextCursor);
  } catch (e) {
    // fail soft to the country's harvested corpus so the UI never breaks
    return stamp(fallback, "corpus", false, now, false,
      `Live fetch failed (${e instanceof Error ? e.message : "error"}); showing harvested ${cc} ads.`);
  }
}
