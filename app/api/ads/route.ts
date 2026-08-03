import { NextResponse } from "next/server";
import competitors from "@/config/competitors.json";
import { fetchAdsForPage, usingRealApi } from "@/lib/meta";
import { sortAds } from "@/lib/score";
import { computeInsights } from "@/lib/insights";
import type { AccountBlock, CompetitorPage, DashboardData } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACCOUNTS = 5;
const ADS_PER_ACCOUNT = 5;

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export async function GET() {
  const cfg = competitors as { country: string; pages: CompetitorPage[] };
  const chosen = pickRandom(cfg.pages, Math.min(ACCOUNTS, cfg.pages.length));

  const accounts: AccountBlock[] = await Promise.all(
    chosen.map(async (page) => {
      let ads = await fetchAdsForPage(page, cfg.country);
      const activeCount = ads.filter((a) => a.isActive).length;
      // Rank by scalability, keep the top 5. Client can re-sort these by date.
      const topAds = sortAds(ads, "score").slice(0, ADS_PER_ACCOUNT);
      return {
        pageId: page.pageId,
        pageName: page.name,
        totalActiveAds: activeCount,
        topAds,
      };
    })
  );

  const data: DashboardData & { insights: ReturnType<typeof computeInsights> } = {
    generatedAt: new Date().toISOString(),
    source: usingRealApi() ? "graph-api" : "mock",
    country: cfg.country,
    accounts,
    insights: computeInsights(accounts),
  };
  return NextResponse.json(data);
}
