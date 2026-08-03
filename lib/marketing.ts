import type { AccountAdPerf, AccountPerf, OwnAccount } from "./types";

const GRAPH_VERSION = "v21.0";

export function usingMarketingApi(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN);
}

// --- seeded PRNG (shared idea with mock.ts, kept local to avoid coupling) ---
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

const AD_NAMES = [
  "Free chat hook — v3",
  "Kundli matching — carousel",
  "Tarot LIVE — reel",
  "Love angle — UGC",
  "Career report — static",
  "2026 horoscope — video",
  "Trust / millions — testimonial",
  "Remedies — reel",
];

/** Realistic mock performance for one account (astrology-app economics). */
function mockAccountPerf(acc: OwnAccount): AccountPerf {
  const rand = mulberry32(seedFrom(acc.accountId));
  const n = 5 + Math.floor(rand() * 3);
  const ads: AccountAdPerf[] = [];
  for (let i = 0; i < n; i++) {
    const impressions = 40000 + Math.floor(rand() * 900000);
    const ctr = 0.7 + rand() * 3.2; // %
    const clicks = Math.round((impressions * ctr) / 100);
    const cpc = 4 + rand() * 12; // ₹
    const spend = Math.round(clicks * cpc);
    const cvr = 0.03 + rand() * 0.12;
    const results = Math.max(1, Math.round(clicks * cvr));
    ads.push({
      adId: `${acc.accountId}_ad${i}`,
      name: AD_NAMES[Math.floor(rand() * AD_NAMES.length)],
      status: rand() < 0.75 ? "ACTIVE" : "PAUSED",
      impressions,
      spend,
      clicks,
      ctr: +ctr.toFixed(2),
      cpc: +cpc.toFixed(2),
      results,
      cpa: +(spend / results).toFixed(2),
      daysActive: 5 + Math.floor(rand() * 220),
    });
  }
  ads.sort((a, b) => b.impressions - a.impressions);
  return buildPerf(acc, "INR", ads);
}

function buildPerf(acc: OwnAccount, currency: string, ads: AccountAdPerf[]): AccountPerf {
  const impressions = ads.reduce((s, a) => s + a.impressions, 0);
  const spend = ads.reduce((s, a) => s + a.spend, 0);
  const clicks = ads.reduce((s, a) => s + a.clicks, 0);
  const results = ads.reduce((s, a) => s + a.results, 0);
  return {
    accountId: acc.accountId,
    name: acc.name,
    business: acc.business,
    currency,
    totals: {
      impressions,
      spend,
      clicks,
      ctr: impressions ? +((clicks / impressions) * 100).toFixed(2) : 0,
      results,
      cpa: results ? +(spend / results).toFixed(2) : 0,
    },
    topAds: ads.slice(0, 5),
  };
}

export async function fetchAccountPerf(
  acc: OwnAccount,
  datePreset: string
): Promise<AccountPerf> {
  if (!usingMarketingApi()) return mockAccountPerf(acc);

  const token = process.env.META_ACCESS_TOKEN!;
  const fields = [
    "ad_id",
    "ad_name",
    "impressions",
    "spend",
    "clicks",
    "ctr",
    "cpc",
    "actions",
  ].join(",");
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${acc.accountId}/insights` +
    `?level=ad&date_preset=${encodeURIComponent(datePreset)}` +
    `&fields=${fields}&limit=200&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) {
    throw new Error(`Marketing API ${res.status} for ${acc.name}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: MarketingRow[] };
  const ads: AccountAdPerf[] = (json.data ?? []).map((r) => {
    const impressions = num(r.impressions);
    const spend = num(r.spend);
    const clicks = num(r.clicks);
    const results = pickResults(r.actions);
    return {
      adId: r.ad_id,
      name: r.ad_name ?? r.ad_id,
      status: "ACTIVE",
      impressions,
      spend,
      clicks,
      ctr: num(r.ctr),
      cpc: num(r.cpc),
      results,
      cpa: results ? +(spend / results).toFixed(2) : 0,
      daysActive: 0,
    };
  });
  ads.sort((a, b) => b.impressions - a.impressions);
  return buildPerf(acc, "INR", ads);
}

interface MarketingRow {
  ad_id: string;
  ad_name?: string;
  impressions?: string;
  spend?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: { action_type: string; value: string }[];
}
function num(v: string | undefined): number {
  return v ? Number(v) : 0;
}
/** Prefer purchase-like conversions; fall back to leads/registrations. */
function pickResults(actions?: { action_type: string; value: string }[]): number {
  if (!actions) return 0;
  const priority = ["purchase", "omni_purchase", "lead", "complete_registration"];
  for (const p of priority) {
    const hit = actions.find((a) => a.action_type.includes(p));
    if (hit) return Number(hit.value);
  }
  return 0;
}
