import type { AccountBlock, AdAngle, AngleStat, MarketInsights, NormalizedAd } from "./types";

/** Aggregate the sampled competitor ads into a market-level insight summary. */
export function computeInsights(accounts: AccountBlock[]): MarketInsights {
  const ads: NormalizedAd[] = accounts.flatMap((a) => a.topAds);
  const total = ads.length;

  const byAngle = new Map<AdAngle, NormalizedAd[]>();
  for (const ad of ads) {
    (byAngle.get(ad.angle) ?? byAngle.set(ad.angle, []).get(ad.angle)!).push(ad);
  }

  const angleLeaderboard: AngleStat[] = [...byAngle.entries()]
    .map(([angle, group]) => ({
      angle,
      count: group.length,
      activeCount: group.filter((a) => a.isActive).length,
      avgScore: Math.round(group.reduce((s, a) => s + a.scalabilityScore, 0) / group.length),
      share: total ? group.length / total : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore || b.count - a.count);

  const longevity = [...ads].sort((a, b) => b.daysActive - a.daysActive)[0];
  const newest = [...ads].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  )[0];

  return {
    sampledAds: total,
    sampledAccounts: accounts.length,
    angleLeaderboard,
    longevityLeader: longevity
      ? {
          pageName: longevity.pageName,
          creativeBody: longevity.creativeBody,
          daysActive: longevity.daysActive,
        }
      : null,
    newestLaunch: newest
      ? { pageName: newest.pageName, creativeBody: newest.creativeBody, startDate: newest.startDate }
      : null,
    activeShare: total ? ads.filter((a) => a.isActive).length / total : 0,
  };
}
