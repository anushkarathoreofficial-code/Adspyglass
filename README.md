# Astro Marketing Intelligence

A Next.js dashboard for researching the **US astrology/psychic and DTC-wellness ad landscape** —
competitor creative, live market trends, and persona fit. It only ever looks at *other* advertisers;
it has no access to and shows nothing about your own ad accounts.

| Tab | What it shows | Source | Key needed |
|---|---|---|---|
| **🎯 Persona × DTC (US)** | 5 random legit DTC wellness brands serving the target persona (astrology/clickbait filtered out) | Harvested US Ad Library ads | none |
| **🔮 Astrology brands** | Brand identity cards (site, tagline, positioning) + their ads oldest-first, playable, shuffleable | Harvested US Ad Library ads | none |
| **🔎 Competitor spy** | Real-time ad search by category (hook/angle/format/funnel/CTA) + live Reddit/Quora/web trend research + a saveable swipe file | **Live**: ScrapeCreators (ads) + Gemini (research) | see below |

Everything works out of the box with **zero credentials** — Persona × DTC and Astrology brands ship
with real harvested ads, and Competitor spy falls back to a harvested corpus. Add the two optional
keys below to make Competitor spy fully live.

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
- **`GEMINI_API_KEY`** — powers the "Live trend research" panel (Reddit/Quora/web via Google Search
  grounding). Free key at aistudio.google.com/apikey. Optional `GEMINI_MODEL` override.

Without these, Competitor spy runs on a harvested corpus and the research panel prompts for the key.

## Features

- **Brand-quality filter** — astrology/psychic, THC/kratom, and dramatized clickbait are excluded
  from the Persona × DTC pool by default.
- **Scalability scoring** — longevity-dominant (oldest still-active creative = proven winner), plus
  variant count. See `lib/score.ts`.
- **Persona-fit scoring** — rates ad copy against the "Emotionally Overloaded Meaning Seeker"
  persona's five converting moves (`lib/persona.ts`).
- **Live category search** — hook/angle/format/funnel/CTA auto-labelled, oldest-first ranking,
  leaderboards per dimension (`lib/spy.ts`, `lib/adlibrary.ts`).
- **Save ads** — a ☆/★ toggle + a **⭐ Saved** swipe-file view, persisted in your browser
  (`localStorage`, nothing server-side).
- **Shuffle** — Astrology brands resamples a fresh set of brands + ads on demand.

## Project map

```
config/astrology-brands.json   harvested astrology/psychic brands (identity + ads)
config/dtc-ads.json            harvested DTC wellness ads (+ excluded examples)
config/us-seed-ads.json        harvested ads for persona-fit scoring
config/spy-corpus.json         harvested corpus fallback for Competitor spy

lib/adlibrary.ts     live Ad Library fetch (ScrapeCreators) + 7h cache + corpus fallback
lib/research.ts      live Reddit/Quora/web trend research (Gemini + Search grounding)
lib/spy.ts           category search + hook/angle/format/funnel/CTA aggregation
lib/brands.ts        brand-radar loader (identity cards + ads oldest-first, shuffle)
lib/dtc.ts           Persona × DTC quality filter + sampling + trend synthesis
lib/persona.ts       persona-fit scoring engine
lib/classify.ts      rule-based creative-angle classifier
lib/score.ts         scalability score (longevity + variants)

app/api/{brands,dtc,persona,research,spy}/route.ts   one endpoint per feature
app/Dashboard.tsx                                     the tabbed UI
```

## ⚠️ Why "live" needs a third-party key

Meta's official Ad Library **API** only returns full results for political/social-issue ads
(everywhere) and for ads targeted to the **EU** (with reach, via the DSA). Ordinary **commercial**
ads targeted to the **US** — exactly the astrology/psychic and DTC-wellness ads this dashboard
studies — are **not available through the official API**, only on the Ad Library website. That's
why real-time fetching here goes through **ScrapeCreators**, a provider that aggregates the public
website, rather than Meta's own endpoint.

## Roadmap ideas

1. **Relevance filtering** on Competitor spy — raw keyword search returns everything mentioning a
   term (e.g. "divorce" surfaces law firms); could narrow to persona-relevant advertisers only.
2. **Daily snapshots** of the harvested corpora to chart longevity/creative turnover over time.
3. **Deploy** — host on Vercel with the two keys as server env vars so the team can use a shared URL.
