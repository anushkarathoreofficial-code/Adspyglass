# Astro Marketing Intelligence

A Next.js dashboard for researching the **US astrology/psychic ad landscape** — competitor creative
and live market trends. It only ever looks at *other* advertisers; it has no access to and shows
nothing about your own ad accounts.

**Live at:** https://adspyglass.vercel.app

| Tab | What it shows | Source | Key needed |
|---|---|---|---|
| **🔮 Astrology brands** | Brand identity cards (site, tagline, positioning) + their ads oldest-first, playable, shuffleable, saveable | Harvested US Ad Library ads | none |
| **🔎 Competitor spy** | Real-time ad search by category (hook/angle/format/funnel/CTA) + live trend research split into **Reddit / Quora / Web** sections + a saveable swipe file | **Live**: ScrapeCreators (ads) + Gemini (research) | see below |

Astrology brands works out of the box with **zero credentials** (real harvested ads). Competitor
spy falls back to a harvested corpus for ads and prompts for a key for research. Add the two
optional keys below to make it fully live.

Every ad card in both tabs has a **☆ Save** toggle. Saved ads land in one shared **⭐ Saved** swipe
file (stored in your browser via `localStorage`) — visible from either tab, tagged with which tab
it came from.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Making Competitor spy live

```bash
cp .env.example .env.local
```

- **`SCRAPECREATORS_API_KEY`** — real-time Ad Library search (scrapecreators.com). Meta's own API
  doesn't return ordinary US commercial ads (see caveat below), so this is a third-party provider.
  Results auto-sync every 7h; a **Sync now** button forces a fresh pull.
- **`GEMINI_API_KEY`** — powers the "Live trend research" panel. Runs **three parallel searches**
  (Reddit-scoped, Quora-scoped, general web) via Google Search grounding, so each platform's column
  shows genuinely distinct findings rather than one blended summary. Free key at
  aistudio.google.com/apikey. Optional `GEMINI_MODEL` override.

Without these, Competitor spy runs on a harvested corpus and each research column prompts for the key.

## Features

- **Live category search** — hook/angle/format/funnel/CTA auto-labelled, oldest-first ranking,
  leaderboards per dimension (`lib/spy.ts`, `lib/adlibrary.ts`).
- **3-way live trend research** — Reddit, Quora, and Web researched independently per category, each
  with its own summary, pain points, real phrases, top questions, and resonant angles + sources
  (`lib/research.ts`).
- **Universal save** — ☆/★ toggle on every ad card in every tab, one shared swipe file
  (`localStorage`, nothing server-side).
- **Scalability signal** — longevity-dominant (oldest still-active creative = proven winner). See
  `lib/score.ts`.
- **Shuffle** — Astrology brands resamples a fresh set of brands + ads on demand.

## Project map

```
config/astrology-brands.json   harvested astrology/psychic brands (identity + ads)
config/us-seed-ads.json        harvested ads for persona-fit scoring (unused by current tabs)
config/spy-corpus.json         harvested corpus fallback for Competitor spy

lib/adlibrary.ts     live Ad Library fetch (ScrapeCreators) + 7h cache + corpus fallback
lib/research.ts      live Reddit / Quora / Web trend research (Gemini + Search grounding)
lib/spy.ts           category search + hook/angle/format/funnel/CTA aggregation
lib/brands.ts        brand-radar loader (identity cards + ads oldest-first, shuffle)
lib/persona.ts       persona-fit scoring engine (used by the orphaned /api/persona endpoint)
lib/classify.ts      rule-based creative-angle classifier
lib/score.ts         scalability score (longevity + variants)

app/api/{brands,research,spy}/route.ts   one endpoint per feature
app/Dashboard.tsx                         the tabbed UI
```

## ⚠️ Why "live" needs a third-party key

Meta's official Ad Library **API** only returns full results for political/social-issue ads
(everywhere) and for ads targeted to the **EU** (with reach, via the DSA). Ordinary **commercial**
ads targeted to the **US** — exactly the astrology/psychic ads this dashboard studies — are **not
available through the official API**, only on the Ad Library website. That's why real-time fetching
here goes through **ScrapeCreators**, a provider that aggregates the public website, rather than
Meta's own endpoint.

## Roadmap ideas

1. **Relevance filtering** on Competitor spy — raw keyword search returns everything mentioning a
   term (e.g. "divorce" surfaces law firms); could narrow to persona-relevant advertisers only.
2. **Daily snapshots** of the harvested corpora to chart longevity/creative turnover over time.
