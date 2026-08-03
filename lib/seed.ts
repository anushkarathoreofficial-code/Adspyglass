import seedFile from "@/config/us-seed-ads.json";
import type { NormalizedAd } from "./types";
import { classifyAngle } from "./classify";
import { scorePersonaFit } from "./persona";
import { daysBetween, scalabilityScore } from "./score";

interface SeedAd {
  libraryId: string;
  advertiser: string;
  startDate: string;
  variantCount: number;
  body: string;
}

/** Load the harvested real Ad Library ads and score each for persona fit. */
export function loadSeedAds(): { ads: NormalizedAd[]; country: string; harvestedAt: string } {
  const file = seedFile as { country: string; harvestedAt: string; ads: SeedAd[] };
  const ads: NormalizedAd[] = file.ads.map((s) => {
    const daysActive = daysBetween(s.startDate, null);
    return {
      id: s.libraryId,
      pageId: s.libraryId,
      pageName: s.advertiser,
      creativeBody: s.body,
      angle: classifyAngle(s.body),
      thumbKey: s.libraryId,
      snapshotUrl: `https://www.facebook.com/ads/library/?id=${s.libraryId}`,
      startDate: s.startDate,
      stopDate: null,
      isActive: true,
      daysActive,
      variantCount: s.variantCount,
      euReach: null,
      platforms: ["facebook", "instagram"],
      scalabilityScore: scalabilityScore({
        daysActive,
        isActive: true,
        variantCount: s.variantCount,
        euReach: null,
      }),
      personaFit: scorePersonaFit(s.body),
    };
  });
  return { ads, country: file.country, harvestedAt: file.harvestedAt };
}
