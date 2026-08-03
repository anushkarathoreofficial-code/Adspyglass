import type { CompetitorPage, NormalizedAd } from "./types";
import { daysBetween, scalabilityScore } from "./score";
import { classifyAngle } from "./classify";
import { scorePersonaFit } from "./persona";

// Seeded PRNG (mulberry32) so a given page always yields the same ads — the
// dashboard stays stable across reloads instead of jittering every request.
function seedFrom(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOOKS = [
  "Talk to India's best astrologers — first chat FREE",
  "Your 2026 horoscope is here 🔮 Find out what the stars say",
  "Confused about love? Ask a verified astrologer now",
  "Kundli matching in 2 minutes — 100% accurate predictions",
  "Feeling stuck? A 10-minute reading can change your week",
  "Millions trust us for daily guidance. Your turn.",
  "Free janam kundli + personalised remedies inside",
  "Career not moving? Get your astro career report today",
  "Match your kundli before you say yes 💍",
  "Tarot reading LIVE — get answers in minutes",
];
const PLATFORM_SETS = [
  ["facebook", "instagram"],
  ["facebook", "instagram", "messenger"],
  ["instagram"],
  ["facebook", "instagram", "audience_network"],
];

/**
 * Generate a realistic spread of ads for a page: a few long-running "winners"
 * (old start dates, many variants) plus a tail of newer/short-lived tests.
 */
export function mockAdsForPage(page: CompetitorPage, country: string): NormalizedAd[] {
  const rand = mulberry32(seedFrom(page.pageId));
  const count = 8 + Math.floor(rand() * 10); // 8-17 ads
  const now = Date.now();
  const ads: NormalizedAd[] = [];

  for (let i = 0; i < count; i++) {
    // Age: skew so ~30% are old winners (up to ~300 days), rest recent.
    const isWinner = rand() < 0.3;
    const ageDays = isWinner
      ? 90 + Math.floor(rand() * 220)
      : Math.floor(rand() * 60);
    const startDate = new Date(now - ageDays * 86400000).toISOString().slice(0, 10);

    // Most old ads are still active; some recent ones already stopped.
    const isActive = isWinner ? rand() < 0.9 : rand() < 0.6;
    const stopDate = isActive
      ? null
      : new Date(now - Math.floor(rand() * ageDays) * 86400000).toISOString().slice(0, 10);

    const variantCount = isWinner ? 3 + Math.floor(rand() * 9) : 1 + Math.floor(rand() * 3);
    const euReach = country === "IN" ? null : Math.floor(rand() * 900000);
    const daysActive = daysBetween(startDate, stopDate);
    const creativeBody = HOOKS[Math.floor(rand() * HOOKS.length)];

    ads.push({
      id: `${page.pageId}_${i}`,
      pageId: page.pageId,
      pageName: page.name,
      creativeBody,
      angle: classifyAngle(creativeBody),
      thumbKey: `${page.pageId}-${i}`,
      snapshotUrl: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&view_all_page_id=${page.pageId}`,
      startDate,
      stopDate,
      isActive,
      daysActive,
      variantCount,
      euReach,
      platforms: PLATFORM_SETS[Math.floor(rand() * PLATFORM_SETS.length)],
      scalabilityScore: scalabilityScore({ daysActive, isActive, variantCount, euReach }),
      personaFit: scorePersonaFit(creativeBody),
    });
  }
  return ads;
}
