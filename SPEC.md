# Spec — Persona × DTC Ad Radar (US)

**Role framing:** PM + eng spec for the default dashboard view that analyzes active US ads for a
target persona, surfacing only legitimate DTC/wellness brands.

## 1. Geographic & brand targeting
- **Region:** United States only (`config/dtc-ads.json.country = "US"`).
- **Brand-quality filter** (`lib/dtc.ts` → `isQuality`): drops any ad flagged `excluded:true` or whose
  `category` matches `/astrology|psychic|horoscope|tarot|thc|kratom|cbd|clickbait/i`. The UI shows
  exactly what was removed and why (transparency), so "unless explicitly requested" is a one-line
  change to the regex.
- **Category scope:** legitimate DTC functional health/wellness (mood/stress gummies, adaptogens,
  cortisol/hormone support, sleep/energy) and lifestyle solutions serving the persona's *emotional*
  needs — anxiety, exhaustion, self-doubt, "feeling misunderstood."

## 2. Ad sampling logic
- One ad per brand (dedupe by `brand`), then **5 distinct brands chosen at random** (Fisher–Yates),
  1 top active ad each. "Reshuffle" re-samples. Pool today = 6 quality brands, 5 filtered out.

## 3. Individual ad breakdown (5 cards)
Each card renders, from hand-annotated real Ad Library data:
| Field | Source field |
|---|---|
| Brand name & category | `brand`, `category` |
| Ad format / media type | `format`, `mediaType` (video/image/carousel) |
| Hook & copy angle | `hook`, `angle` |
| Sales approach & funnel type | `salesApproach`, `funnelType` |
| Call to action | `cta` |
| *(bonus)* Persona need served | `personaNeed` — the explicit link to the persona's ranked pains |

## 4. Trending insights panel
`lib/dtc.ts` → `synthesize()` computes, across the sampled 5: format distribution, sales-approach
distribution, CTA mix, media mix, recurring hook themes (regex over hook+angle), and a plain-English
synthesis (video vs static dominance, leading format/approach/CTA, top hook theme, and the winning
pattern for this persona).

## Architecture
```
config/dtc-ads.json     real harvested US ads + annotations + excluded set
lib/dtc.ts              quality filter · sampler · trend synthesis
app/api/dtc/route.ts    returns { persona, cards[5], trends, excluded[] }
app/Dashboard.tsx       DtcTab (default) — persona brief · filter note · 5 cards · trends panel
```

## Data pipeline & the harvesting reality
The Meta Ad Library **website** returns US commercial ads (the API does not); it is JS-gated and
scraping it server-side violates ToS. So harvesting is done **interactively (Claude via browser)**
into `config/dtc-ads.json`; the app is the analysis/synthesis layer. Fields like format, sales
approach, and funnel are human/LLM annotations of each real ad — the part a raw API could never give.

## Extensibility
- **New persona / niche:** swap the harvested pool + `personaNeed` tags; the filter, sampler, and
  trends engine are persona-agnostic.
- **Other ad networks** (TikTok Creative Center, Google Ads Transparency): add an adapter that emits
  the same annotated shape; everything downstream is unchanged.
- **Scale annotation:** an LLM pass can auto-fill format/approach/funnel/CTA from raw ad copy so
  harvesting becomes near-automatic.
