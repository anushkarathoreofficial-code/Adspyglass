import type { PersonaFit } from "./persona";

export interface CompetitorPage {
  pageId: string;
  name: string;
}

/** Creative angle buckets — the "message" a given ad is testing. */
export type AdAngle =
  | "Love & Relationships"
  | "Career & Money"
  | "Kundli & Matchmaking"
  | "Tarot"
  | "Horoscope"
  | "Free Trial / Offer"
  | "Remedies & Puja"
  | "General / Trust";

/** A single ad, normalized from either the Graph API or the mock backend. */
export interface NormalizedAd {
  id: string;
  pageId: string;
  pageName: string;
  creativeBody: string;
  angle: AdAngle;
  /** deterministic gradient key so the UI can render a stable placeholder thumbnail */
  thumbKey: string;
  /** link to the ad on the Meta Ad Library website */
  snapshotUrl: string;
  startDate: string; // ISO date
  stopDate: string | null; // null => still active
  isActive: boolean;
  daysActive: number;
  /** how many near-duplicate creatives of this ad are running concurrently */
  variantCount: number;
  /** EU reach when available (DSA); null for non-EU commercial ads */
  euReach: number | null;
  platforms: string[];
  /** 0-100 composite; encodes "oldest active = most scalable" */
  scalabilityScore: number;
  /** how well the ad copy speaks to the target persona */
  personaFit: PersonaFit;
}

export interface AccountBlock {
  pageId: string;
  pageName: string;
  totalActiveAds: number;
  topAds: NormalizedAd[];
}

export interface DashboardData {
  generatedAt: string;
  source: "graph-api" | "mock";
  country: string;
  accounts: AccountBlock[];
}

export type SortMode = "score" | "date";

// Persona finder ------------------------------------------------------------

export interface PersonaData {
  generatedAt: string;
  source: "ad-library-harvest";
  country: string;
  harvestedAt: string;
  ads: NormalizedAd[]; // ranked by persona fit
}

// Brand radar (astrology sandbox) -------------------------------------------

export interface BrandAd {
  libraryId: string;
  startDate: string;
  mediaType: "video" | "image" | "carousel";
  durationSec?: number;
  hook: string;
  snapshotUrl: string;
}

export interface BrandCard {
  brand: string;
  category: string;
  site: string;
  siteUrl: string;
  tagline: string;
  positioning: string;
  adsLiveNote: string;
  oldestDate: string;
  ads: BrandAd[]; // oldest first, max 5
}

export interface BrandsData {
  generatedAt: string;
  country: string;
  harvestedAt: string;
  brands: BrandCard[];
}

// Competitor spy (SpyGlass-style) -------------------------------------------

export interface SpyAd {
  brand: string;
  libraryId: string;
  snapshotUrl: string;
  startDate: string;
  daysActive: number;
  mediaType: "video" | "image" | "carousel";
  format: string;
  hook: string;
  angle: string;
  cta: string;
  funnel: string;
  categories: string[];
}

export interface SpyResult {
  query: string;
  count: number;
  totalCorpus: number;
  ads: SpyAd[]; // oldest first (proven winners)
  angleLeaderboard: CountItem[];
  formatMix: CountItem[];
  funnelMix: CountItem[];
  ctaMix: CountItem[];
  mediaMix: CountItem[];
  suggestions: string[]; // category chips
  // live-fetch / auto-sync metadata
  source: "scrapecreators" | "corpus";
  live: boolean;
  cached: boolean;
  fetchedAt: string;
  nextSyncAt: string;
  note?: string;
}

// Live trend research (Gemini + Google Search grounding) --------------------

export interface ResearchSource {
  title: string;
  url: string;
}

export interface TopicResearch {
  source: "gemini" | "unavailable" | "error";
  topic: string;
  summary: string;
  trendingPains: string[];
  phrases: string[]; // exact language people use (Reddit/Quora voice)
  questions: string[]; // top questions people ask
  angles: string[]; // ad angles that would resonate now
  sources: ResearchSource[];
  note?: string; // e.g. "set GEMINI_API_KEY", or an error message
}

// Persona × DTC dashboard (US) ----------------------------------------------

export interface DtcCard {
  brand: string;
  category: string;
  libraryId: string;
  snapshotUrl: string;
  startDate: string;
  daysActive: number;
  variantCount: number;
  mediaType: "video" | "image" | "carousel";
  format: string;
  hook: string;
  angle: string;
  salesApproach: string;
  funnelType: string;
  cta: string;
  personaNeed: string;
  personaFitScore: number;
}

export interface CountItem {
  label: string;
  count: number;
}

export interface DtcTrends {
  formats: CountItem[];
  salesApproaches: CountItem[];
  ctas: CountItem[];
  mediaMix: CountItem[];
  recurringHooks: CountItem[];
  synthesis: string[];
}

export interface DtcData {
  generatedAt: string;
  source: "ad-library-harvest";
  country: string;
  harvestedAt: string;
  poolSize: number; // legitimate brands available
  excludedCount: number; // filtered by brand-quality filter
  excluded: { brand: string; category: string; reason: string }[];
  cards: DtcCard[]; // exactly 5
  trends: DtcTrends;
}

// ---------------------------------------------------------------------------
// Market insights (aggregate across the sampled competitors)
// ---------------------------------------------------------------------------

export interface AngleStat {
  angle: AdAngle;
  count: number;
  activeCount: number;
  avgScore: number;
  share: number; // 0-1 of total sampled ads
}

export interface MarketInsights {
  sampledAds: number;
  sampledAccounts: number;
  angleLeaderboard: AngleStat[];
  longevityLeader: { pageName: string; creativeBody: string; daysActive: number } | null;
  newestLaunch: { pageName: string; creativeBody: string; startDate: string } | null;
  activeShare: number; // 0-1
}

// ---------------------------------------------------------------------------
// Own-account performance (Marketing API)
// ---------------------------------------------------------------------------

export interface OwnAccount {
  accountId: string; // act_XXXX
  name: string;
  business: string;
}

export interface AccountAdPerf {
  adId: string;
  name: string;
  status: "ACTIVE" | "PAUSED";
  impressions: number;
  spend: number; // in account currency
  clicks: number;
  ctr: number; // %
  cpc: number;
  results: number; // conversions (purchases / leads)
  cpa: number; // cost per result
  daysActive: number;
}

export interface AccountPerf {
  accountId: string;
  name: string;
  business: string;
  currency: string;
  totals: {
    impressions: number;
    spend: number;
    clicks: number;
    ctr: number;
    results: number;
    cpa: number;
  };
  topAds: AccountAdPerf[];
}

export interface AccountsData {
  generatedAt: string;
  source: "marketing-api" | "mock";
  datePreset: string;
  accounts: AccountPerf[];
}

// ---------------------------------------------------------------------------
// Demand signal (Google Trends)
// ---------------------------------------------------------------------------

export interface TrendPoint {
  date: string; // ISO week
  value: number; // 0-100 relative interest
}

export interface TrendSeries {
  keyword: string;
  points: TrendPoint[];
  latest: number;
  changePct: number; // vs start of window
  peak: number;
}

export interface TrendsData {
  generatedAt: string;
  source: "serpapi" | "mock";
  geo: string;
  window: string;
  series: TrendSeries[];
  rising: { query: string; growth: string }[];
}
