import dtcFile from "@/config/dtc-ads.json";
import type { CountItem, DtcCard, DtcData, DtcTrends } from "./types";
import { daysBetween } from "./score";
import { scorePersonaFit } from "./persona";

interface RawAd {
  brand: string;
  category: string;
  libraryId: string;
  startDate: string;
  variantCount?: number;
  mediaType: "video" | "image" | "carousel";
  format?: string;
  hook: string;
  angle?: string;
  salesApproach?: string;
  funnelType?: string;
  cta?: string;
  personaNeed?: string;
  body: string;
  excluded?: boolean;
  excludeReason?: string;
}

// Brand-quality filter (spec 1): categories we never surface unless asked.
const EXCLUDED_CATEGORY_RE =
  /astrology|psychic|horoscope|tarot|thc|kratom|clickbait|cbd/i;

function isQuality(a: RawAd): boolean {
  if (a.excluded) return false;
  if (EXCLUDED_CATEGORY_RE.test(a.category)) return false;
  return true;
}

function toCard(a: RawAd): DtcCard {
  const daysActive = daysBetween(a.startDate, null);
  return {
    brand: a.brand,
    category: a.category,
    libraryId: a.libraryId,
    snapshotUrl: `https://www.facebook.com/ads/library/?id=${a.libraryId}`,
    startDate: a.startDate,
    daysActive,
    variantCount: a.variantCount ?? 1,
    mediaType: a.mediaType,
    format: a.format ?? "—",
    hook: a.hook,
    angle: a.angle ?? "—",
    salesApproach: a.salesApproach ?? "—",
    funnelType: a.funnelType ?? "—",
    cta: a.cta ?? "—",
    personaNeed: a.personaNeed ?? "—",
    personaFitScore: scorePersonaFit(`${a.hook} ${a.body}`).score,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

function tally(values: string[]): CountItem[] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

// Pull short hook themes for the "recurring hooks" synthesis.
const HOOK_THEMES: { label: string; re: RegExp }[] = [
  { label: "Cortisol / stress framing", re: /cortisol|stress|overdrive|burnout|anxiety/i },
  { label: "Personal transformation / before-after", re: /pictures of me|before|transform|fixed my|my story/i },
  { label: "Expert / lab authority", re: /\bPA\b|doctor|lab|ranked|study|clinically|third[- ]party/i },
  { label: "Underserved / \"finally gets me\"", re: /finally|misunderstood|overlook|especially|nobody/i },
  { label: "Aspirational self-care ritual", re: /haul|obsessed|routine|self[- ]care|glow/i },
  { label: "Natural alternative", re: /natural|plant|organic|without prescription/i },
];

function synthesize(cards: DtcCard[]): DtcTrends {
  const formats = tally(cards.map((c) => c.format));
  const salesApproaches = tally(cards.map((c) => c.salesApproach));
  const ctas = tally(cards.map((c) => c.cta));
  const mediaMix = tally(cards.map((c) => c.mediaType));
  const hookText = cards.map((c) => `${c.hook} ${c.angle}`).join("  ");
  const recurringHooks = HOOK_THEMES
    .map((t) => ({ label: t.label, count: (hookText.match(t.re) || []).length }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count);

  const n = cards.length;
  const video = cards.filter((c) => c.mediaType === "video").length;
  const topApproach = salesApproaches[0];
  const topFormat = formats[0];
  const topCta = ctas[0];
  const synthesis: string[] = [];
  if (video >= Math.ceil(n / 2))
    synthesis.push(`Video dominates — ${video}/${n} ads are video (UGC / advertorial), not static.`);
  if (topFormat) synthesis.push(`Leading format: ${topFormat.label} (${topFormat.count}/${n}).`);
  if (topApproach)
    synthesis.push(`Most common sales structure: ${topApproach.label} (${topApproach.count}/${n}).`);
  if (topCta) synthesis.push(`"${topCta.label}" is the dominant CTA (${topCta.count}/${n}) — direct-response, not brand.`);
  if (recurringHooks[0])
    synthesis.push(`Recurring hook theme: ${recurringHooks[0].label} — resonates with the persona's low-grade anxiety and "I'm exhausted" state.`);
  synthesis.push(
    "Winning pattern for this persona: a relatable human voice (founder/creator/expert) + concrete proof + a single low-risk next step — mirroring the persona's skepticism and need for organized answers."
  );

  return { formats, salesApproaches, ctas, mediaMix, recurringHooks, synthesis };
}

/** Apply the quality filter, sample 5 distinct random brands (1 ad each), synthesize trends. */
export function buildDtcDashboard(): DtcData {
  const file = dtcFile as { country: string; harvestedAt: string; ads: RawAd[] };
  const quality = file.ads.filter(isQuality);
  const rejected = file.ads.filter((a) => !isQuality(a));

  // one ad per brand, then 5 random distinct brands
  const byBrand = new Map<string, RawAd>();
  for (const a of quality) if (!byBrand.has(a.brand)) byBrand.set(a.brand, a);
  const cards = shuffle([...byBrand.values()]).slice(0, 5).map(toCard);

  return {
    generatedAt: new Date().toISOString(),
    source: "ad-library-harvest",
    country: file.country,
    harvestedAt: file.harvestedAt,
    poolSize: byBrand.size,
    excludedCount: rejected.length,
    excluded: rejected.map((a) => ({
      brand: a.brand,
      category: a.category,
      reason: a.excludeReason ?? "Failed brand-quality filter",
    })),
    cards,
    trends: synthesize(cards),
  };
}
