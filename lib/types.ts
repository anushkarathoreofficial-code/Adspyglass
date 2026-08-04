import type { PersonaFit } from "./persona";

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

export interface CountItem {
  label: string;
  count: number;
}

// Live trend research (Gemini + Google Search grounding) --------------------
// Split per-platform so Reddit / Quora / general-web findings are genuinely
// distinct rather than one blended summary.

export interface ResearchSource {
  title: string;
  url: string;
}

export interface PlatformFindings {
  summary: string;
  painPoints: string[];
  phrases: string[]; // exact language people use on this platform
  questions: string[]; // top questions people ask
  angles: string[]; // ad angles that would resonate now
  sources: ResearchSource[];
  note?: string; // per-platform error/empty note
}

export interface TopicResearch {
  source: "gemini" | "unavailable" | "error";
  topic: string;
  reddit: PlatformFindings;
  quora: PlatformFindings;
  web: PlatformFindings;
  note?: string; // top-level note (e.g. "set GEMINI_API_KEY")
}

// Universal saved-ads swipe file ---------------------------------------------
// Minimal shape shared by every ad-bearing tab so one localStorage file works
// everywhere ("save ads in all").

export interface SavedAd {
  libraryId: string;
  brand: string;
  hook: string;
  snapshotUrl: string;
  startDate: string;
  origin: "astrology-brands" | "competitor-spy";
}
