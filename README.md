# Astro Marketing Intelligence

A Next.js dashboard for researching the **US astrology/psychic ad landscape** — competitor creative
and live market demand, split into five focused tabs. It only ever looks at *other* advertisers; it
has no access to and shows nothing about your own ad accounts.

**Live at:** https://adspyglass.vercel.app

| Tab | What it shows | Source | Key needed |
|---|---|---|---|
| **🔮 Astrology brands** | Brand identity cards (site, tagline, positioning) + their ads oldest-first, playable, shuffleable, saveable, downloadable | Harvested US Ad Library ads | none |
| **🔎 Competitor spy** | Real-time ad search by category (hook/angle/format/funnel/CTA), oldest-first ranking, leaderboards | **Live**: ScrapeCreators | see below |
| **👽 Reddit** | Top 5 real, current Reddit stories for your keyword, reshufflable | **Live**: Gemini + Search grounding | see below |
| **❓ Quora** | Top 5 real, current Quora stories for your keyword, reshufflable | **Live**: Gemini + Search grounding | see below |
| **🌐 Web** | Top 5 real, current web stories (news/blogs) for your keyword, reshufflable | **Live**: Gemini + Search grounding | see below |

Astrology brands works out of the box with **zero credentials** (real harvested ads). Competitor
spy falls back to a harvested corpus without a key. The three story tabs need a Gemini key — add it
once via the in-app key bar (see below) and all three go live immediately.

Every **ad** card (Astrology brands + Competitor spy) has a **☆ Save** toggle and a **⬇ Download**
button. Saved ads land in one shared **⭐ Saved** swipe file (`localStorage`), tagged with which tab
it came from. Download links to the real Ad Library media file (video/image) when the provider
exposes one, falling back to the Ad Library page otherwise — browsers may open the file rather than
force-download it, depending on CORS.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Going live

**Competitor spy** — `SCRAPECREATORS_API_KEY` in `.env.local` (scrapecreators.com). Meta's own API
doesn't return ordinary US commercial ads (see caveat below), so this is a third-party provider.
Results auto-sync every 7h; a **Sync now** button forces a fresh pull.

**Reddit / Quora / Web** — a **Gemini API key**, entered directly in the app:
1. Open any of the three story tabs.
2. Paste your key into the **🔑 Gemini key** bar at the top (free key at aistudio.google.com/apikey).
3. It's saved to your browser's `localStorage` and sent only as a request header to this app's own
   API route — never written to a file, never committed, never shared across browsers/devices.

No `GEMINI_API_KEY` env var is required — the key bar is the intended way to configure this. (A
server-side `GEMINI_API_KEY`/`GEMINI_MODEL` in `.env.local` still works as a fallback for anyone who
prefers that route.)

## Features

- **Top-5 reshufflable stories** — each of Reddit/Quora/Web independently searches a keyword and
  returns 5 real, current stories (title, gist, link, source). **🔀 Reshuffle** re-runs the search
  live with a higher-temperature, anti-repeat prompt so you get a genuinely different set, not a
  client-side reshuffle of the same handful (`lib/research.ts`).
- **Domain-locked links** — every story's link is validated server-side to actually resolve to the
  tab's platform (reddit.com/redd.it for Reddit, quora.com for Quora; Web excludes both). Off-domain
  or lookalike links (e.g. an article merely discussing Reddit) are dropped rather than shown.
- **Live category search** — hook/angle/format/funnel/CTA auto-labelled, oldest-first ranking,
  leaderboards per dimension (`lib/spy.ts`, `lib/adlibrary.ts`).
- **Universal save + download** — every ad card in every ad-bearing tab has ☆ Save and ⬇ Download.
  Save uses one shared swipe file (`localStorage`, nothing server-side).
- **Scalability signal** — longevity-dominant (oldest still-active creative = proven winner). See
  `lib/score.ts`.
- **Shuffle** — Astrology brands resamples a fresh set of brands + ads on demand.

## Project map

```
config/astrology-brands.json   harvested astrology/psychic brands (identity + ads)
config/us-seed-ads.json        harvested ads for persona-fit scoring (unused by current tabs)
config/spy-corpus.json         harvested corpus fallback for Competitor spy

lib/adlibrary.ts     live Ad Library fetch (ScrapeCreators) + 7h cache + corpus fallback + media URLs
lib/research.ts      top-5 story fetch per platform (Gemini + Search grounding), with shuffle nudge
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

## Security

- **Secrets never reach the client.** API keys are read only in server-side `lib/` files (no
  `NEXT_PUBLIC_` prefix), never logged, never returned in responses, and never committed
  (`.env*` is gitignored; `.env.example` holds only blank placeholders). Store real keys as env vars
  on the host (Railway / Vercel).
- **Bring-your-own Gemini key** stays in the user's own browser `localStorage` and is sent only as a
  request header to this app's own `/api/research` route over HTTPS — never persisted server-side.
- **Rate limiting** (`lib/ratelimit.ts`) — `/api/spy` and `/api/research` spend paid third-party
  credits, so they're capped per-IP (30 req/min) to prevent a public URL from being hammered into a
  surprise bill ("denial of wallet"). Returns `429` + `Retry-After`; fails open on internal error.
- **URL-scheme guarding** — third-party media URLs (from ScrapeCreators) are restricted to `http(s)`
  before being placed in an `href`; story links are validated to their real platform domain. No
  `javascript:`/`data:` URL can reach the DOM.
- **Security headers** (`next.config.mjs`) — `X-Frame-Options: DENY` + `frame-ancestors 'none'`
  (anti-clickjacking), `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `X-Powered-By`
  removed. All outbound links use `rel="noreferrer"`.

## Roadmap ideas

1. **Relevance filtering** on Competitor spy — raw keyword search returns everything mentioning a
   term (e.g. "divorce" surfaces law firms); could narrow to persona-relevant advertisers only.
2. **Daily snapshots** of the harvested corpora to chart longevity/creative turnover over time.
