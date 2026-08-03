import type { TrendSeries, TrendsData } from "./types";

export function usingSerpApi(): boolean {
  return Boolean(process.env.SERPAPI_KEY);
}

const KEYWORDS = ["astrology", "kundli", "tarot reading", "horoscope 2026", "love astrology"];
const WEEKS = 12;

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
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic mock interest-over-time with a gentle trend + weekly noise. */
function mockSeries(keyword: string): TrendSeries {
  const rand = mulberry32(seedFrom(keyword));
  const trend = (rand() - 0.4) * 4; // slope per week
  let base = 40 + rand() * 30;
  const points = [];
  const now = Date.now();
  for (let w = WEEKS - 1; w >= 0; w--) {
    const date = new Date(now - w * 7 * 86400000).toISOString().slice(0, 10);
    const val = Math.max(0, Math.min(100, base + (WEEKS - w) * trend + (rand() - 0.5) * 12));
    points.push({ date, value: Math.round(val) });
  }
  const first = points[0].value || 1;
  const latest = points[points.length - 1].value;
  return {
    keyword,
    points,
    latest,
    changePct: Math.round(((latest - first) / first) * 100),
    peak: Math.max(...points.map((p) => p.value)),
  };
}

export async function fetchTrends(geo: string): Promise<TrendsData> {
  const generatedAt = new Date().toISOString();
  if (!usingSerpApi()) {
    const series = KEYWORDS.map(mockSeries);
    return {
      generatedAt,
      source: "mock",
      geo,
      window: `${WEEKS} weeks`,
      series,
      rising: [
        { query: "ai astrology app", growth: "+180%" },
        { query: "free kundli matching online", growth: "+90%" },
        { query: "tarot reading online", growth: "+70%" },
        { query: "astrologer near me", growth: "+45%" },
      ],
    };
  }
  // Real: SerpAPI Google Trends engine. One call per keyword (interest_over_time).
  const series: TrendSeries[] = [];
  for (const kw of KEYWORDS) {
    const url =
      `https://serpapi.com/search.json?engine=google_trends&data_type=TIMESERIES` +
      `&geo=${encodeURIComponent(geo)}&q=${encodeURIComponent(kw)}` +
      `&api_key=${encodeURIComponent(process.env.SERPAPI_KEY!)}`;
    const res = await fetch(url, { next: { revalidate: 21600 } });
    if (!res.ok) throw new Error(`SerpAPI ${res.status} for "${kw}"`);
    const json = (await res.json()) as SerpTrends;
    const points = (json.interest_over_time?.timeline_data ?? []).map((d) => ({
      date: d.date,
      value: d.values?.[0]?.extracted_value ?? 0,
    }));
    const first = points[0]?.value || 1;
    const latest = points[points.length - 1]?.value ?? 0;
    series.push({
      keyword: kw,
      points,
      latest,
      changePct: Math.round(((latest - first) / first) * 100),
      peak: points.length ? Math.max(...points.map((p) => p.value)) : 0,
    });
  }
  return { generatedAt, source: "serpapi", geo, window: `${WEEKS} weeks`, series, rising: [] };
}

interface SerpTrends {
  interest_over_time?: {
    timeline_data?: { date: string; values?: { extracted_value: number }[] }[];
  };
}
