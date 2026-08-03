"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AccountsData,
  BrandsData,
  DashboardData,
  DtcData,
  MarketInsights,
  NormalizedAd,
  PersonaData,
  SortMode,
  SpyResult,
  TopicResearch,
  TrendsData,
  TrendSeries,
} from "@/lib/types";
import { sortAds } from "@/lib/score";

type Tab = "dtc" | "persona" | "competitors";
type AdsPayload = DashboardData & { insights: MarketInsights };

interface PersonaMeta {
  name: string;
  who: string;
  coreInsight: string;
  buys: string[];
  convertingMoves: { label: string; desc: string }[];
  rejects: string[];
  topPains: string[];
}
type PersonaPayload = PersonaData & { persona: PersonaMeta };
type DtcPayload = DtcData & { persona: PersonaMeta };
const fitClass = (s: number) => (s >= 65 ? "hi" : s >= 40 ? "mid" : "lo");

// ---------- formatting helpers ----------
const int = (n: number) => n.toLocaleString("en-IN");
const short = (n: number) =>
  n >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`;
const inr = (n: number) => `₹${short(n)}`;

function gradient(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `linear-gradient(135deg, hsl(${h % 360} 65% 45%), hsl(${(h + 40) % 360} 70% 35%))`;
}
const scoreClass = (s: number) => (s >= 60 ? "hi" : s >= 35 ? "mid" : "lo");

function Sparkline({ points, up }: { points: { value: number }[]; up: boolean }) {
  const w = 120, h = 34, max = Math.max(1, ...points.map((p) => p.value));
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${h - (p.value / max) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={d} fill="none" stroke={up ? "#35c98b" : "#ef6b6b"} strokeWidth="2" />
    </svg>
  );
}

// ---------- competitors tab ----------
function AdRow({ ad }: { ad: NormalizedAd }) {
  return (
    <a className="ad" href={ad.snapshotUrl} target="_blank" rel="noreferrer">
      <div className="thumb" style={{ background: gradient(ad.thumbKey) }} />
      <div className="body">
        <p className="text">{ad.creativeBody}</p>
        <div className="meta">
          <span className={`pfit-badge ${fitClass(ad.personaFit.score)}`}>persona {ad.personaFit.score}</span>
          <span className="angle-tag">{ad.angle}</span>
          <span className={`pill ${ad.isActive ? "active" : "stopped"}`}>{ad.isActive ? "ACTIVE" : "STOPPED"}</span>
          <span>{ad.daysActive}d</span>
          <span className="dot">•</span>
          <span>from {ad.startDate}</span>
          <span className="dot">•</span>
          <span>{ad.variantCount} variant{ad.variantCount !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div className={`score ${scoreClass(ad.scalabilityScore)}`}>
        <div className="num">{ad.scalabilityScore}</div>
        <div className="lbl">scale</div>
      </div>
    </a>
  );
}

function LeaderPanel({ title, items }: { title: string; items: SpyResult["angleLeaderboard"] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="spy-panel">
      <h4>{title}</h4>
      {items.map((i) => (
        <div key={i.label}>
          <div className="lead-row"><span>{i.label}</span><span className="c" style={{ color: "var(--muted)" }}>{i.count}</span></div>
          <div className="lead-bar"><div style={{ width: `${(i.count / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function SpyAdRow({ a, oldest, saved, onToggleSave }: { a: SpyResult["ads"][number]; oldest: boolean; saved: boolean; onToggleSave: () => void }) {
  return (
    <div className="spy-ad">
      <div className="r1">
        <span className="brand">{a.brand}</span>
        <span className="age">{oldest ? "★ longest-running · " : ""}{a.daysActive}d active</span>
      </div>
      <div className="hook">&ldquo;{a.hook}&rdquo;</div>
      <div className="spy-labels">
        <div><div className="k">Angle</div>{a.angle}</div>
        <div><div className="k">Format</div>{a.format}</div>
        <div><div className="k">Funnel</div>{a.funnel}</div>
        <div><div className="k">CTA</div>{a.cta}</div>
      </div>
      <div className="foot">
        <span className="cats">{a.categories.slice(0, 4).join(" · ")}</span>
        <span className="fr">
          <button className={`save-btn ${saved ? "saved" : ""}`} onClick={onToggleSave}>{saved ? "★ Saved" : "☆ Save"}</button>
          <a className="plink" href={a.snapshotUrl} target="_blank" rel="noreferrer">▶ Play / open →</a>
        </span>
      </div>
    </div>
  );
}

// localStorage-backed swipe file
function useSavedAds() {
  const [saved, setSaved] = useState<SpyResult["ads"]>([]);
  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem("savedAds") || "[]")); } catch { /* ignore */ }
  }, []);
  const persist = (next: SpyResult["ads"]) => {
    setSaved(next);
    try { localStorage.setItem("savedAds", JSON.stringify(next)); } catch { /* ignore */ }
  };
  const isSaved = (id: string) => saved.some((s) => s.libraryId === id);
  const toggle = (ad: SpyResult["ads"][number]) => {
    persist(isSaved(ad.libraryId) ? saved.filter((s) => s.libraryId !== ad.libraryId) : [ad, ...saved]);
  };
  return { saved, isSaved, toggle };
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}
function untilTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "now";
  const totalMin = Math.round(diff / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function ResearchPanel({ r, loading }: { r: TopicResearch | null; loading: boolean }) {
  if (loading) {
    return <div className="research"><div className="rhead"><h3>🌐 Live trend research — Reddit · Quora · web</h3></div><div className="rnote">Researching what&rsquo;s trending right now…</div></div>;
  }
  if (!r) return null;
  if (r.source !== "gemini") {
    return (
      <div className="research">
        <div className="rhead"><h3>🌐 Live trend research — Reddit · Quora · web</h3></div>
        <div className="rnote">{r.note}</div>
      </div>
    );
  }
  const cols: { title: string; items: string[]; cls?: string }[] = [
    { title: "Trending pain points", items: r.trendingPains },
    { title: "Real phrases people use", items: r.phrases, cls: "phrase" },
    { title: "Top questions asked", items: r.questions },
    { title: "Angles that would resonate", items: r.angles },
  ];
  return (
    <div className="research">
      <div className="rhead">
        <h3>🌐 Live trend research — Reddit · Quora · web</h3>
        <span className="live-dot">● live · &ldquo;{r.topic}&rdquo;</span>
      </div>
      {r.summary && <div className="rsummary">{r.summary}</div>}
      <div className="rgrid">
        {cols.map((c) => c.items.length > 0 && (
          <div key={c.title}>
            <h5>{c.title}</h5>
            <ul className={c.cls}>{c.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
      {r.sources.length > 0 && (
        <div className="rsources">
          {r.sources.map((s, i) => <a key={i} href={s.url} target="_blank" rel="noreferrer">🔗 {s.title || new URL(s.url).hostname}</a>)}
        </div>
      )}
    </div>
  );
}

const SEVEN_HOURS_MS = 7 * 60 * 60 * 1000;

function SpyTab() {
  const [input, setInput] = useState("");
  const [data, setData] = useState<SpyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [research, setResearch] = useState<TopicResearch | null>(null);
  const [researching, setResearching] = useState(false);
  const [view, setView] = useState<"search" | "saved">("search");
  const queryRef = useRef("");
  const { saved, isSaved, toggle } = useSavedAds();

  const runResearch = useCallback(async (query: string) => {
    if (!query.trim()) { setResearch(null); return; }
    setResearching(true);
    setResearch(null);
    try {
      const res = await fetch(`/api/research?q=${encodeURIComponent(query)}&t=${Date.now()}`, { cache: "no-store" });
      setResearch(await res.json());
    } catch (e) {
      setResearch({ source: "error", topic: query, summary: "", trendingPains: [], phrases: [], questions: [], angles: [], sources: [], note: e instanceof Error ? e.message : "Research failed" });
    } finally { setResearching(false); }
  }, []);

  const run = useCallback(async (query: string, force = false) => {
    queryRef.current = query;
    setLoading(true);
    setError(null);
    runResearch(query); // fire in parallel; research is slower than the ad search
    try {
      const res = await fetch(`/api/spy?q=${encodeURIComponent(query)}${force ? "&sync=1" : ""}&t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }, [runResearch]);
  useEffect(() => { run("astrology"); }, [run]); // load a live category on open

  // auto-sync every 7h with fresh ads (while the tab is open)
  useEffect(() => {
    const id = setInterval(() => run(queryRef.current, true), SEVEN_HOURS_MS);
    return () => clearInterval(id);
  }, [run]);

  const search = (query: string) => { setInput(query); setView("search"); run(query); };

  return (
    <>
      <div className="banner live">
        <b>Competitor spy.</b> Search a category (divorce, ex back, marriage, cheating, astrology…) — get <b>live trends</b> from Reddit / Quora / the web <i>plus</i> the real ads brands are running for it (hooks, angles, formats, funnels).
      </div>

      {data && (
        <div className="syncbar">
          <div className="l">
            <span className={`live-pill ${data.live ? "on" : "off"}`}>{data.live ? "● LIVE" : "◌ CORPUS"}</span>
            <span>{data.live ? "Ad Library" : "Harvested ads"} · synced {relTime(data.fetchedAt)} · auto-sync in {untilTime(data.nextSyncAt)}</span>
          </div>
          <div className="r">
            <button className={view === "search" ? "on" : ""} onClick={() => setView("search")}>Search</button>
            <button className={view === "saved" ? "on" : ""} onClick={() => setView("saved")}>⭐ Saved ({saved.length})</button>
            <button onClick={() => run(queryRef.current || input, true)} disabled={loading}>{loading ? "Syncing…" : "🔄 Sync now"}</button>
          </div>
        </div>
      )}

      {data?.note && <div className="excluded-note" style={{ margin: "0 0 12px" }}>{data.note}</div>}

      {view === "saved" ? (
        <>
          <div className="spy-count"><b>{saved.length}</b> saved ad{saved.length !== 1 ? "s" : ""} · your swipe file (stored in this browser)</div>
          {saved.length === 0
            ? <div className="excluded-note">No saved ads yet. Hit ☆ Save on any ad to build your swipe file.</div>
            : saved.map((a) => <SpyAdRow key={a.libraryId} a={a} oldest={false} saved onToggleSave={() => toggle(a)} />)}
        </>
      ) : (
        <>
          <form className="spy-search" onSubmit={(e) => { e.preventDefault(); run(input); }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search a category or angle — e.g. divorce, ex back, marriage, cheating…"
            />
            <button type="submit">Spy</button>
          </form>

          {data && (
            <div className="chips" style={{ marginBottom: 4 }}>
              {data.suggestions.map((s) => (
                <button key={s} className={`chip ${data.query === s ? "active" : ""}`} onClick={() => search(s)}>{s}</button>
              ))}
            </div>
          )}

          {(researching || research) && <ResearchPanel r={research} loading={researching} />}

          {loading && <div className="loading">Searching ads…</div>}
          {error && <div className="error">⚠️ {error}</div>}

          {data && !loading && (
            <>
              <div className="spy-count">
                <b>{data.count}</b> ads{data.query ? <> for &ldquo;<b>{data.query}</b>&rdquo;</> : " (all)"} · from {data.totalCorpus} {data.live ? "live" : "harvested"}. Sorted oldest-first (proven winners on top).
              </div>

              {data.count === 0 ? (
                <div className="excluded-note">
                  No ads for &ldquo;{data.query}&rdquo; yet. {data.live ? "Try another category." : "Ask me to harvest this category, or add a provider key for live fetching."}
                </div>
              ) : (
                <div className="spy-layout">
                  <div>
                    {data.ads.map((a, i) => (
                      <SpyAdRow key={a.libraryId} a={a} oldest={i === 0} saved={isSaved(a.libraryId)} onToggleSave={() => toggle(a)} />
                    ))}
                  </div>
                  <div>
                    <LeaderPanel title="Hook & angle leaderboard" items={data.angleLeaderboard} />
                    <LeaderPanel title="Format mix" items={data.formatMix} />
                    <LeaderPanel title="Funnel mix" items={data.funnelMix} />
                    <LeaderPanel title="CTA mix" items={data.ctaMix} />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

// ---------- my accounts tab ----------
function AccountsTab() {
  const [data, setData] = useState<AccountsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/accounts?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="loading">Loading your account performance…</div>;
  if (error) return <div className="error">⚠️ {error}</div>;
  if (!data) return null;

  const grand = data.accounts.reduce(
    (s, a) => ({ imp: s.imp + a.totals.impressions, spend: s.spend + a.totals.spend, res: s.res + a.totals.results }),
    { imp: 0, spend: 0, res: 0 }
  );

  return (
    <>
      <div className={`banner ${data.source === "marketing-api" ? "live" : ""}`}>
        {data.source === "marketing-api" ? (
          <><b>Live</b> Marketing API data · {data.datePreset}.</>
        ) : (
          <><b>Mock data.</b> Set <code>META_ACCESS_TOKEN</code> (with <code>ads_read</code> on these accounts) to pull real impressions, spend & CPA · {data.datePreset}.</>
        )}
      </div>

      <div className="insights">
        <div className="kpi"><div className="lbl">Total impressions</div><div className="val">{short(grand.imp)}</div><div className="sub">across {data.accounts.length} accounts</div></div>
        <div className="kpi"><div className="lbl">Total spend</div><div className="val">{inr(grand.spend)}</div><div className="sub">{data.datePreset}</div></div>
        <div className="kpi"><div className="lbl">Results</div><div className="val">{short(grand.res)}</div><div className="sub">purchases / leads</div></div>
        <div className="kpi"><div className="lbl">Blended CPA</div><div className="val">₹{grand.res ? Math.round(grand.spend / grand.res) : 0}</div><div className="sub">spend ÷ results</div></div>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        {data.accounts.map((acc) => (
          <section className="account" key={acc.accountId} style={{ gridColumn: "1 / -1" }}>
            <div className="head">
              <span className="name">{acc.name} <span className="biz-tag">· {acc.business}</span></span>
              <span className="count">{acc.accountId}</span>
            </div>
            <div className="acct-totals">
              <div className="t">Impr<b>{short(acc.totals.impressions)}</b></div>
              <div className="t">Spend<b>{inr(acc.totals.spend)}</b></div>
              <div className="t">CTR<b>{acc.totals.ctr}%</b></div>
              <div className="t">Results<b>{int(acc.totals.results)}</b></div>
              <div className="t">CPA<b>₹{int(acc.totals.cpa)}</b></div>
            </div>
            <table className="perf-table">
              <thead>
                <tr><th>Ad</th><th>Impr</th><th>Spend</th><th>CTR</th><th>CPC</th><th>Results</th><th>CPA</th></tr>
              </thead>
              <tbody>
                {acc.topAds.map((ad) => (
                  <tr key={ad.adId}>
                    <td>{ad.name}</td>
                    <td>{short(ad.impressions)}</td>
                    <td>{inr(ad.spend)}</td>
                    <td>{ad.ctr}%</td>
                    <td>₹{ad.cpc}</td>
                    <td>{int(ad.results)}</td>
                    <td>₹{int(ad.cpa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </>
  );
}

// ---------- trends tab ----------
function TrendRow({ s }: { s: TrendSeries }) {
  const up = s.changePct >= 0;
  return (
    <div className="trend-row">
      <span className="kw">{s.keyword}</span>
      <Sparkline points={s.points} up={up} />
      <span style={{ textAlign: "right" }}>
        <b style={{ color: up ? "var(--good)" : "var(--bad)" }}>{up ? "▲" : "▼"} {Math.abs(s.changePct)}%</b>
        <div className="biz-tag">now {s.latest} · peak {s.peak}</div>
      </span>
    </div>
  );
}

function TrendsTab() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/trends?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="loading">Loading demand signals…</div>;
  if (error) return <div className="error">⚠️ {error}</div>;
  if (!data) return null;

  return (
    <>
      <div className={`banner ${data.source === "serpapi" ? "live" : ""}`}>
        {data.source === "serpapi" ? (
          <><b>Live</b> Google Trends (SerpAPI) · geo {data.geo} · {data.window}.</>
        ) : (
          <><b>Mock data.</b> Set <code>SERPAPI_KEY</code> for live Google Trends · geo {data.geo}.</>
        )}
      </div>
      <div className="leader">
        <h3>Search interest — astrology keywords ({data.window}, geo {data.geo})</h3>
        {data.series.map((s) => <TrendRow key={s.keyword} s={s} />)}
      </div>
      {data.rising.length > 0 && (
        <div className="leader">
          <h3>Rising queries — creative angles to test next</h3>
          <div className="rising">
            {data.rising.map((r) => <span className="r" key={r.query}>{r.query} <b>{r.growth}</b></span>)}
          </div>
        </div>
      )}
    </>
  );
}

// ---------- astrology sandbox → brand radar ----------
function brandGradient(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `linear-gradient(135deg, hsl(${h % 360} 62% 42%), hsl(${(h + 55) % 360} 66% 32%))`;
}
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="#fff"><path d="M4 2.5v11l9-5.5z" /></svg>
);

function AdTile({ ad, oldest }: { ad: BrandsData["brands"][number]["ads"][number]; oldest: boolean }) {
  return (
    <a className="ad-tile" href={ad.snapshotUrl} target="_blank" rel="noreferrer" title="Play in Meta Ad Library">
      <div className="ad-thumb" style={{ background: brandGradient(ad.libraryId) }}>
        {oldest && <span className="badge-old">oldest</span>}
        <span className="play"><PlayIcon /></span>
        {ad.mediaType === "video" && ad.durationSec && (
          <span className="dur">{Math.floor(ad.durationSec / 60)}:{String(ad.durationSec % 60).padStart(2, "0")}</span>
        )}
      </div>
      <div className="hook">{ad.hook}</div>
      <div className="started">Started {ad.startDate} · <span className="go">▶ play</span></div>
    </a>
  );
}

function BrandCardView({ b }: { b: BrandsData["brands"][number] }) {
  return (
    <div className="brand-card">
      <div className="brand-top">
        <div className="brand-logo" style={{ background: brandGradient(b.brand) }}>{b.brand[0]}</div>
        <div className="brand-id">
          <div className="name">{b.brand}</div>
          <div className="cat">{b.category} · {b.adsLiveNote}</div>
          <div className="site">🔗 <a href={b.siteUrl} target="_blank" rel="noreferrer">{b.site}</a></div>
        </div>
        <a className="visit-btn" href={b.siteUrl} target="_blank" rel="noreferrer">Visit →</a>
      </div>
      <div className="brand-tagline">&ldquo;{b.tagline}&rdquo;</div>
      <div className="brand-positioning">{b.positioning}</div>
      <div className="ad-strip-label">Their ads · oldest first ({b.ads.length})</div>
      <div className="ad-strip">
        {b.ads.map((ad, i) => <AdTile key={ad.libraryId} ad={ad} oldest={i === 0} />)}
      </div>
    </div>
  );
}

function BrandRadarTab() {
  const [data, setData] = useState<BrandsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shuffled, setShuffled] = useState(false);

  const load = useCallback(async (doShuffle: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/brands?t=${Date.now()}${doShuffle ? "&shuffle=1" : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setShuffled(doShuffle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(false); }, [load]);

  if (loading && !data) return <div className="loading">Loading brands…</div>;
  if (error) return <div className="error">⚠️ {error}</div>;
  if (!data) return null;

  return (
    <>
      <div className="banner live">
        <b>{data.brands.length} psychic/astrology brands</b> from the US Ad Library. Each shows its site, its tagline (from its ads), and its ads {shuffled ? "(shuffled)" : "oldest-first"} — click any ad to play it.
      </div>
      <div className="controls" style={{ margin: "0 0 6px" }}>
        <button className="btn" onClick={() => load(true)} disabled={loading}>
          {loading ? "Shuffling…" : "🔀 Shuffle brands & ads"}
        </button>
        {shuffled && (
          <button className="btn" onClick={() => load(false)} disabled={loading}>↺ Back to oldest-first</button>
        )}
      </div>
      {data.brands.map((b) => <BrandCardView key={b.brand} b={b} />)}
    </>
  );
}

// ---------- persona × DTC tab (spec v2) ----------
function DtcCardView({ c }: { c: DtcData["cards"][number] }) {
  return (
    <div className="dtc">
      <div>
        <span className="brand">{c.brand}</span>
        <span className="mediatag">{c.mediaType}</span>
        <div><span className="cat">{c.category}</span></div>
      </div>
      <div className="fields">
        <div className="f">
          <div className="k">Hook & copy angle</div>
          <div className="v hook">&ldquo;{c.hook}&rdquo;</div>
          <div className="v" style={{ color: "var(--muted)", marginTop: 3 }}>{c.angle}</div>
        </div>
        <div className="f">
          <div className="k">Ad format / media</div>
          <div className="v">{c.format}</div>
        </div>
        <div className="f">
          <div className="k">Sales approach & funnel</div>
          <div className="v">{c.salesApproach}</div>
          <div className="v" style={{ color: "var(--muted)", marginTop: 2 }}>Funnel: {c.funnelType}</div>
        </div>
        <div className="f">
          <div className="k">Call to action</div>
          <span className="cta-pill">{c.cta}</span>
        </div>
        <div className="need">Serves persona need: <b>{c.personaNeed}</b></div>
      </div>
      <div className="foot">
        <span>{c.daysActive}d active · {c.variantCount} variant{c.variantCount !== 1 ? "s" : ""}</span>
        <a className="plink" href={c.snapshotUrl} target="_blank" rel="noreferrer">Open in Ad Library →</a>
      </div>
    </div>
  );
}

function CountList({ items }: { items: DtcData["trends"]["formats"] }) {
  return (
    <>
      {items.map((i) => (
        <div className="crow" key={i.label}><span>{i.label}</span><span className="c">{i.count}</span></div>
      ))}
    </>
  );
}

function DtcTab() {
  const [data, setData] = useState<DtcPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dtc?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <div className="loading">Sampling US DTC ads for the persona…</div>;
  if (error) return <div className="error">⚠️ {error}</div>;
  if (!data) return null;
  const t = data.trends;

  return (
    <>
      <div className="banner live">
        <b>US market · legitimate DTC wellness.</b> 5 ads from 5 distinct brands (1 top active ad each), serving the persona&rsquo;s emotional needs. Real ads harvested {data.harvestedAt}.
      </div>

      <div className="persona-brief">
        <h2>🎯 {data.persona.name}</h2>
        <div className="who">{data.persona.who}</div>
        <div className="insight">{data.persona.coreInsight}</div>
        <div className="who" style={{ marginTop: 8 }}>Supply = wellness/DTC brands that remove this persona&rsquo;s emotional load (cortisol, mood, energy, sleep). Astrology/psychic explicitly filtered out.</div>
      </div>

      <div className="excluded-note">
        <b>Brand-quality filter removed {data.excludedCount}</b> spammy/off-persona ads from the pool of {data.poolSize + data.excludedCount}:
        <ul>
          {data.excluded.map((e) => <li key={e.brand}>{e.brand} <span style={{ opacity: .7 }}>({e.category})</span> — {e.reason}</li>)}
        </ul>
      </div>

      <div className="controls" style={{ margin: "6px 0 2px" }}>
        <button className="btn" onClick={load} disabled={loading}>{loading ? "Loading…" : "↻ Reshuffle 5 brands"}</button>
      </div>

      <div className="dtc-grid">
        {data.cards.map((c) => <DtcCardView key={c.libraryId} c={c} />)}
      </div>

      <div className="trends-panel">
        <h3>📈 Trending insights — what&rsquo;s working across these 5 brands</h3>
        <div className="sub">Synthesized live from the sampled ads (US market).</div>
        <div className="trends-cols">
          <div><h4>Top formats</h4><CountList items={t.formats} /></div>
          <div><h4>Sales approaches</h4><CountList items={t.salesApproaches} /></div>
          <div><h4>CTA mix</h4><CountList items={t.ctas} /></div>
          <div><h4>Recurring hooks</h4><CountList items={t.recurringHooks} /></div>
        </div>
        <ul className="syn">
          {t.synthesis.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>
    </>
  );
}

// ---------- shell ----------
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("dtc");
  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>🔮 Astro Marketing Intelligence</h1>
          <p>Your performance · competitor creative · market demand — one view</p>
        </div>
      </header>

      <div className="tabs">
        <button className={tab === "dtc" ? "active" : ""} onClick={() => setTab("dtc")}>🎯 Persona × DTC (US)</button>
        <button className={tab === "persona" ? "active" : ""} onClick={() => setTab("persona")}>🔮 Astrology brands</button>
        <button className={tab === "competitors" ? "active" : ""} onClick={() => setTab("competitors")}>🔎 Competitor spy</button>
      </div>

      {tab === "dtc" && <DtcTab />}
      {tab === "persona" && <BrandRadarTab />}
      {tab === "competitors" && <SpyTab />}

      <div className="footnote">
        <b>Persona × DTC:</b> 5 random legit DTC brands serving the persona&rsquo;s needs (astrology/clickbait filtered out). <b>Astrology brands:</b> brand identity + ads oldest-first, shuffle for a new set. <b>Competitor spy:</b> live Reddit/Quora/web trend research (Gemini) + real ads by category.
      </div>
    </div>
  );
}
