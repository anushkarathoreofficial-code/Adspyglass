# Astro Marketing Intelligence

A Next.js dashboard that triangulates the three signals that actually drive ad decisions:

| Tab | Signal | Source | Real-data requirement |
|---|---|---|---|
| **🎯 Persona finder** | Which live ads speak to our target persona, and *why* | Real ads harvested from the Ad Library (US) | none — ships with real harvested ads |
| **Competitor intel** | What competitors are scaling (longevity = scalability) | Meta Ad Library API | `META_ACCESS_TOKEN` *(EU-targeted only — see caveat)* |
| **My accounts** | Your real impressions / spend / CTR / CPA | Meta **Marketing** API | `META_ACCESS_TOKEN` with `ads_read` on the accounts |
| **Market trends** | What the market is searching for | Google Trends (SerpAPI) | `SERPAPI_KEY` |

## 🔮 Astrology brands (brand radar)

A clean, jargon-free view of real psychic/astrology advertisers from the US Ad Library. Each brand
is an **identity card**: logo, name, category, clickable **website**, a **Visit →** button, a
**tagline synthesized from its ads**, a one-line positioning read, and a strip of its **ads
oldest-first** (oldest = most proven) rendered as playable tiles — click any tile to open/play it in
the Ad Library. Brands are ordered by their longest-running ad. Data: `config/astrology-brands.json`
· loader `lib/brands.ts` · `app/api/brands`.

## 🎯 Persona finder (scoring engine)

Operationalizes the **"Emotionally Overloaded Meaning Seeker"** persona (26–42, ~80% female, US,
uncertain relationship) into a live scoring engine. It rates any ad's copy 0–100 on how well it
speaks this persona's emotional language — and shows *why*.

- **Converting checklist** — scores each ad against the persona's five converting moves: real
  emotional moment · acknowledges skepticism · specific turning point · concrete personalized proof
  · low-risk next step.
- **Signals** — detects persona language: pattern recognition, relationship uncertainty,
  meaning-seeking, validation/permission, human-not-AI trust, career direction.
- **Red-flag warnings** — flags the clichés the persona *rejects*: "unlock your destiny", "manifest
  abundance", overly-mystical branding, and **AI pretending to replace human intuition**.
- Ships with **12 real ads harvested from the US Ad Library on 2026-07-31** — Mediumchat (86, the
  one fully-tuned ad), Spiritual Glows/Psychic Marie, Adam Roa "soulmate initials", Chris Riley,
  and **your own Lumus** psychic-storytelling ads — so it works with zero setup.

Engine: `lib/persona.ts` · harvested ads: `config/us-seed-ads.json` · loader: `lib/seed.ts`.

### How the "surfing" works (important)

The Meta Ad Library **website** (unlike the API) *does* return US commercial psychic/astrology ads,
but it's JS-gated and against ToS to scrape server-side. So the harvesting is done **interactively
by Claude via the browser** — I open the Ad Library, pull matching ads, and append them to
`config/us-seed-ads.json`. The app is the **intelligence layer** that scores and ranks them. To
refresh: ask me to re-harvest (I'll add new ads/dates), or paste ad copy in and I'll score it.

Everything runs on **realistic mock data out of the box** — no credentials needed. Each source flips
to live independently when you add its key.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Features

- **5 random competitor accounts × top 5 ads**, ranked by a 0–100 **scalability score** (longevity-dominant — the oldest still-active creatives are the proven winners).
- **Creative-angle classification** — every ad auto-bucketed (Love, Career, Kundli, Tarot, Horoscope, Offer, Remedies, Trust) with a market **angle leaderboard** showing what's being scaled.
- **Market-insight KPIs** — winning angle, longevity leader, newest launch, % still active.
- **Sort by scale / oldest-first**, filter by angle, reshuffle accounts.
- **My accounts** — per-account and per-ad real KPIs (impressions, spend, CTR, CPC, results, CPA) + blended totals.
- **Market trends** — 12-week search-interest sparklines + rising queries to mine for new angles.

## Project map

```
config/competitors.json   competitor Pages to sample (the "5 random accounts")
config/accounts.json      YOUR ad accounts (from the meta-ad-accounts registry)
lib/meta.ts               Ad Library adapter  (Graph API ↔ mock)
lib/marketing.ts          Marketing API adapter (own-account perf ↔ mock)
lib/trends.ts             Google Trends adapter (SerpAPI ↔ mock)
lib/classify.ts           rule-based creative-angle classifier
lib/score.ts              scalability score + sort modes
lib/insights.ts           market-level aggregation
app/api/{ads,accounts,trends}/route.ts   one endpoint per tab
app/Dashboard.tsx         the tabbed UI
```

## ⚠️ The India-commercial-ads caveat (unchanged, important)

Meta's official Ad Library **API** returns full results only for political/issue ads (everywhere) and
for **EU-targeted** ads (with reach). Ordinary **commercial** ads targeted to **India** are *not*
available through the API — only on the Ad Library website. So the Competitor tab's *live* mode is
reliable for EU research; for India competitor creative you'll want a third-party provider or a
periodic manual export plugged in behind `lib/meta.ts`. This is exactly why the scoring leans on
longevity + variants rather than impressions.

---

# ✅ What I need from you to make each part live

Fill in only the parts you care about — each is independent.

### 1. Competitor intel (Ad Library)
- [ ] A **Meta access token** → `META_ACCESS_TOKEN` in `.env.local`. From a Meta developer app; the `ALL` ad-type search also needs the querying user to have completed Meta ID confirmation.
- [ ] Real **Page IDs** for competitors → edit `config/competitors.json`. Get each from an Ad Library URL: `facebook.com/ads/library/?view_all_page_id=XXXX`.
- [ ] Decide target country. For *live* results today, an EU code (e.g. `DE`) actually returns data; `IN` will be sparse (see caveat). If India competitor data is essential, tell me and I'll wire a **third-party provider**.

### 2. My accounts (real performance — highest value)
- [ ] The **same `META_ACCESS_TOKEN`**, but it must have **`ads_read`** permission and access to the ad accounts. Easiest source: a **System User token** from Business Manager (long-lived).
- [ ] Confirm the **account list** in `config/accounts.json` (I pre-filled 7 from the registry — Astrotalk India/Native/NRI/Vernac, Lumus, Store). Add/remove as you like.
- [ ] Confirm the **window** (currently `last_30d`) and what counts as a **"result"** — I default to purchase → lead → registration. Tell me your true north-star conversion (e.g. recharge, first-chat) and I'll map it exactly.

### 3. Market trends (Google Trends)
- [ ] A **SerpAPI key** → `SERPAPI_KEY` in `.env.local` (serpapi.com; free tier works for testing). Google has no official Trends API, so this is the pragmatic route.
- [ ] Confirm the **keyword list** (currently astrology / kundli / tarot / horoscope 2026 / love astrology) — send me your priority terms.

### Setup once you have keys
```bash
cp .env.example .env.local
# add any of: META_ACCESS_TOKEN=...   SERPAPI_KEY=...
npm run dev
```
The banners at the top of each tab turn **green** when that source is live.

## Roadmap (say the word and I'll build)
1. **Daily snapshots + change alerts** (Postgres/SQLite) — chart longevity over time; alert on new competitor winners or killed ads.
2. **Trend ↔ creative matching** — auto-flag competitor ads whose angle aligns with a *rising* query.
3. **Cross-reference with Databricks** — join Meta spend to your recharge/LTV cohorts (via the `astrotalk-databricks` skill).
4. **Deploy** — host it (Vercel/internal) with the token in server env so the team can use it.
```
