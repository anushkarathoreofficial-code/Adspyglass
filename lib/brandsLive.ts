import type { BrandAd, BrandCard, BrandsData } from "./types";
import { fetchCategoryAds, hasProvider, type RawSpyAd } from "./adlibrary";
import { loadBrands } from "./brands";

// Astrology/psychic seed queries. Each Astrology-brands load runs one of these
// against the live Ad Library and groups the results into brand cards. Shuffling
// rotates the seed (and re-orders), so new advertisers surface each time.
const SEED_QUERIES = [
  "psychic reading",
  "astrology reading",
  "tarot reading",
  "love psychic",
  "clairvoyant",
  "medium reading",
  "spiritual reading",
  "horoscope",
];

// Strong, specific signals in ad copy/categories (avoids common words like
// "reading"/"manifest" that leak in unrelated brands).
const STRONG = /psychic|astrolog|tarot|clairvoyant|horoscope|zodiac|numerolog|soulmate|birth ?chart|natal chart|fortune ?tell|spirit guide|palm read|aura read/i;
// Brand-name hints are more permissive — an astrology name is itself the signal.
const BRAND_HINT = /psychic|astro|tarot|clairvoyant|horoscope|zodiac|numerolog|\bmedium\b|spiritual|cosmic|mystic|oracle|celestial|soulmate|divine|angel|moon/i;
const EXCLUDE_BRAND = /\b(lumus|astrotalk)\b/i; // never surface the user's own brands (standing rule)

function isRelevant(brand: string, ads: RawSpyAd[]): boolean {
  if (BRAND_HINT.test(brand)) return true;
  return ads.some(
    (a) => STRONG.test(a.hook) || STRONG.test(a.body ?? "") || (a.pageCategories ?? []).some((c) => STRONG.test(c))
  );
}

function pickSeed(shuffle: boolean): string {
  if (!shuffle) return SEED_QUERIES[0];
  return SEED_QUERIES[Math.floor(Math.random() * SEED_QUERIES.length)];
}

function hostname(url?: string): string | undefined {
  if (!url) return undefined;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return undefined; }
}

function toBrandCard(brand: string, ads: RawSpyAd[]): BrandCard {
  const sorted = [...ads].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const withSite = sorted.find((a) => a.siteUrl);
  const siteUrl = withSite?.siteUrl ?? `https://www.facebook.com/ads/library/?id=${sorted[0].libraryId}`;
  const site = withSite?.siteDomain ?? hostname(withSite?.siteUrl) ?? "Ad Library";
  const brandAds: BrandAd[] = sorted.slice(0, 5).map((a) => ({
    libraryId: a.libraryId,
    startDate: a.startDate,
    mediaType: a.mediaType,
    hook: a.hook,
    snapshotUrl: `https://www.facebook.com/ads/library/?id=${a.libraryId}`,
    mediaUrl: a.mediaUrl,
  }));
  const cats = sorted.flatMap((a) => a.pageCategories ?? []);
  return {
    brand,
    category: cats[0] ? `${cats[0]} · US Ad Library` : "Psychic / astrology · US Ad Library",
    site,
    siteUrl,
    tagline: sorted[sorted.length - 1]?.hook || sorted[0].hook, // most recent creative's hook
    positioning: `${ads.length} live ad${ads.length !== 1 ? "s" : ""} in this pull · CTA: ${sorted[0].cta}`,
    adsLiveNote: `${ads.length} live ad${ads.length !== 1 ? "s" : ""}`,
    oldestDate: sorted[0].startDate,
    ads: brandAds,
  };
}

/**
 * Build the Astrology-brands view from LIVE Ad Library data (grouped by advertiser).
 * Falls back to the static harvested config when no provider key is set or nothing relevant comes back.
 */
export async function loadBrandsLive(shuffle = false): Promise<BrandsData> {
  if (!hasProvider()) {
    return { ...loadBrands(shuffle), source: "harvested", note: "Add SCRAPECREATORS_API_KEY for live brands. Showing harvested set." };
  }

  const seed = pickSeed(shuffle);
  try {
    const fetched = await fetchCategoryAds(seed, shuffle); // shuffle bypasses the 7h cache for a fresh pull
    // group by pageId (fallback brand name)
    const groups = new Map<string, { brand: string; ads: RawSpyAd[] }>();
    for (const a of fetched.ads) {
      if (EXCLUDE_BRAND.test(a.brand)) continue;
      const key = a.pageId || a.brand;
      const g = groups.get(key) ?? { brand: a.brand, ads: [] };
      g.ads.push(a);
      groups.set(key, g);
    }

    let brands = [...groups.values()]
      .filter((g) => isRelevant(g.brand, g.ads))
      .map((g) => toBrandCard(g.brand, g.ads))
      .sort((a, b) => new Date(a.oldestDate).getTime() - new Date(b.oldestDate).getTime());

    if (shuffle) brands = brands.sort(() => Math.random() - 0.5);
    brands = brands.slice(0, 8);

    if (brands.length === 0) {
      return { ...loadBrands(shuffle), source: "harvested", note: `No live astrology brands for “${seed}” right now — showing harvested set.` };
    }

    return {
      generatedAt: new Date().toISOString(),
      country: "US",
      harvestedAt: seed,
      brands,
      source: fetched.live ? "live" : "harvested",
      note: fetched.live ? undefined : fetched.note,
    };
  } catch {
    return { ...loadBrands(shuffle), source: "harvested", note: "Live fetch failed — showing harvested set." };
  }
}
