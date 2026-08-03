import brandsFile from "@/config/astrology-brands.json";
import type { BrandAd, BrandCard, BrandsData } from "./types";

interface RawBrandAd {
  libraryId: string;
  startDate: string;
  mediaType: "video" | "image" | "carousel";
  durationSec?: number;
  hook: string;
}
interface RawBrand {
  brand: string;
  category: string;
  site: string;
  siteUrl: string;
  tagline: string;
  positioning: string;
  adsLiveNote: string;
  ads: RawBrandAd[];
}

function shuffle<T>(arr: T[]): T[] {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

const MAX_BRANDS = 5;
const MAX_ADS = 5;

/**
 * @param randomize when true, sample a random set of brands and a random set of
 *   each brand's ads (for the Shuffle button). When false, show every brand with
 *   its oldest ads first, brands ordered by longest-running ad (most proven).
 */
export function loadBrands(randomize = false): BrandsData {
  const file = brandsFile as { country: string; harvestedAt: string; brands: RawBrand[] };

  const chosen = randomize ? shuffle(file.brands).slice(0, MAX_BRANDS) : file.brands;

  const brands: BrandCard[] = chosen.map((b) => {
    const ordered = randomize
      ? shuffle(b.ads) // random ads each shuffle
      : [...b.ads].sort((x, y) => new Date(x.startDate).getTime() - new Date(y.startDate).getTime());
    const ads: BrandAd[] = ordered.slice(0, MAX_ADS).map((a) => ({
      ...a,
      snapshotUrl: `https://www.facebook.com/ads/library/?id=${a.libraryId}`,
    }));
    const oldestDate = [...b.ads]
      .map((a) => a.startDate)
      .sort((x, y) => new Date(x).getTime() - new Date(y).getTime())[0] ?? "";
    return {
      brand: b.brand,
      category: b.category,
      site: b.site,
      siteUrl: b.siteUrl,
      tagline: b.tagline,
      positioning: b.positioning,
      adsLiveNote: b.adsLiveNote,
      oldestDate,
      ads,
    };
  });

  if (randomize) brands.sort(() => Math.random() - 0.5);
  else brands.sort((a, b) => new Date(a.oldestDate).getTime() - new Date(b.oldestDate).getTime());

  return {
    generatedAt: new Date().toISOString(),
    country: file.country,
    harvestedAt: file.harvestedAt,
    brands,
  };
}
