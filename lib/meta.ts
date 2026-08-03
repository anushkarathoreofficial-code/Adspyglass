import type { CompetitorPage, NormalizedAd } from "./types";
import { daysBetween, scalabilityScore } from "./score";
import { mockAdsForPage } from "./mock";
import { classifyAngle } from "./classify";
import { scorePersonaFit } from "./persona";

const GRAPH_VERSION = "v21.0";

/**
 * The single seam between "real data" and "mock data".
 *
 * If META_ACCESS_TOKEN is set we hit the official Ad Library API
 * (ads_archive). Otherwise we return realistic mock data so the whole
 * dashboard works with zero credentials.
 *
 * NOTE: The official API only returns full results for political/issue ads
 * everywhere, and for ALL ads targeted to the EU (with reach). Ordinary
 * commercial ads targeted to India are generally NOT returned by the API —
 * they are only visible on the Ad Library website. So for IN competitor
 * research, expect the API to return few/no rows and rely on mock (or a
 * different data source) until that changes.
 */
export function usingRealApi(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN);
}

export async function fetchAdsForPage(
  page: CompetitorPage,
  country: string
): Promise<NormalizedAd[]> {
  if (!usingRealApi()) {
    return mockAdsForPage(page, country);
  }
  return fetchAdsFromGraph(page, country);
}

interface GraphAd {
  id: string;
  page_id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  publisher_platforms?: string[];
  eu_total_reach?: number;
}

async function fetchAdsFromGraph(
  page: CompetitorPage,
  country: string
): Promise<NormalizedAd[]> {
  const token = process.env.META_ACCESS_TOKEN!;
  const fields = [
    "id",
    "page_id",
    "page_name",
    "ad_creative_bodies",
    "ad_delivery_start_time",
    "ad_delivery_stop_time",
    "ad_snapshot_url",
    "publisher_platforms",
    "eu_total_reach",
  ].join(",");

  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/ads_archive` +
    `?search_page_ids=${encodeURIComponent(page.pageId)}` +
    `&ad_type=ALL` +
    `&ad_active_status=ALL` +
    `&ad_reached_countries=["${country}"]` +
    `&fields=${fields}` +
    `&limit=100` +
    `&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API ${res.status} for ${page.name}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: GraphAd[] };
  const rows = json.data ?? [];

  // Group near-identical creatives (same body text) into variant clusters so
  // we can count how many copies of a winning creative are running.
  const byBody = new Map<string, GraphAd[]>();
  for (const r of rows) {
    const key = (r.ad_creative_bodies?.[0] ?? r.id).trim().slice(0, 120);
    (byBody.get(key) ?? byBody.set(key, []).get(key)!).push(r);
  }

  const ads: NormalizedAd[] = [];
  for (const group of byBody.values()) {
    const rep = group[0];
    const startDate = (rep.ad_delivery_start_time ?? "").slice(0, 10);
    const stopRaw = rep.ad_delivery_stop_time ?? null;
    const isActive = !stopRaw;
    const stopDate = stopRaw ? stopRaw.slice(0, 10) : null;
    if (!startDate) continue;
    const daysActive = daysBetween(startDate, stopDate);
    const euReach = rep.eu_total_reach ?? null;
    const variantCount = group.length;
    const creativeBody = rep.ad_creative_bodies?.[0] ?? "(no text)";

    ads.push({
      id: rep.id,
      pageId: rep.page_id ?? page.pageId,
      pageName: rep.page_name ?? page.name,
      creativeBody,
      angle: classifyAngle(creativeBody),
      thumbKey: rep.id,
      snapshotUrl:
        rep.ad_snapshot_url ??
        `https://www.facebook.com/ads/library/?view_all_page_id=${page.pageId}`,
      startDate,
      stopDate,
      isActive,
      daysActive,
      variantCount,
      euReach,
      platforms: rep.publisher_platforms ?? [],
      scalabilityScore: scalabilityScore({ daysActive, isActive, variantCount, euReach }),
      personaFit: scorePersonaFit(creativeBody),
    });
  }
  return ads;
}
