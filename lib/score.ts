import type { NormalizedAd } from "./types";

const DAY_MS = 1000 * 60 * 60 * 24;

export function daysBetween(startISO: string, endISO: string | null): number {
  const start = new Date(startISO).getTime();
  const end = endISO ? new Date(endISO).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

/**
 * Composite "scalability" score, 0-100.
 *
 * Convention (from the user): the oldest still-active ads are the most
 * scalable — a creative that has run for months without being turned off is a
 * proven winner. Since the public Ad Library API does not expose impressions
 * for commercial ads, longevity is the dominant signal, complemented by:
 *   - how many near-duplicate variants are running (advertisers scale winners
 *     by spinning up copies), and
 *   - EU reach when the DSA makes it available.
 */
export function scalabilityScore(input: {
  daysActive: number;
  isActive: boolean;
  variantCount: number;
  euReach: number | null;
}): number {
  const { daysActive, isActive, variantCount, euReach } = input;

  // Longevity — caps at 180 days. Dominant factor (0-60).
  const longevity = Math.min(daysActive / 180, 1) * 60;

  // Variant count — advertisers duplicate winners (0-25).
  const variants = Math.min(variantCount / 10, 1) * 25;

  // Reach — only when available, else 0 (0-15).
  const reach = euReach ? Math.min(euReach / 1_000_000, 1) * 15 : 0;

  let score = longevity + variants + reach;

  // A stopped ad is no longer "scalable"; halve it so active ads rank first.
  if (!isActive) score *= 0.5;

  return Math.round(score);
}

export function sortAds(ads: NormalizedAd[], mode: "score" | "date"): NormalizedAd[] {
  const copy = [...ads];
  if (mode === "date") {
    // Oldest first — the convention's headline view.
    copy.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  } else {
    copy.sort((a, b) => b.scalabilityScore - a.scalabilityScore);
  }
  return copy;
}
