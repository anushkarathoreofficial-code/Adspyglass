"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrandsData, Platform, PlatformResult, SavedAd, SpyResult } from "@/lib/types";

type Tab = "persona" | "competitors" | "reddit" | "quora" | "web";

const CATEGORY_CHIPS = ["ex back", "cheating", "divorce", "marriage", "soulmate", "astrology", "career", "skeptic"];

// ---------- universal saved-ads swipe file ----------
function useSavedAds() {
  const [saved, setSaved] = useState<SavedAd[]>([]);
  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem("savedAds") || "[]")); } catch { /* ignore */ }
  }, []);
  const persist = (next: SavedAd[]) => {
    setSaved(next);
    try { localStorage.setItem("savedAds", JSON.stringify(next)); } catch { /* ignore */ }
  };
  const isSaved = (id: string) => saved.some((s) => s.libraryId === id);
  const toggle = (ad: SavedAd) => {
    persist(isSaved(ad.libraryId) ? saved.filter((s) => s.libraryId !== ad.libraryId) : [ad, ...saved]);
  };
  return { saved, isSaved, toggle };
}

// ---------- locally-stored Gemini key (bring-your-own-key, browser-only) ----------
const GEMINI_KEY_STORAGE = "geminiApiKey";

function useLocalGeminiKey() {
  const [key, setKeyState] = useState("");
  useEffect(() => {
    try { setKeyState(localStorage.getItem(GEMINI_KEY_STORAGE) || ""); } catch { /* ignore */ }
  }, []);
  const setKey = (next: string) => {
    setKeyState(next);
    try {
      if (next) localStorage.setItem(GEMINI_KEY_STORAGE, next);
      else localStorage.removeItem(GEMINI_KEY_STORAGE);
    } catch { /* ignore */ }
  };
  return { key, setKey };
}

function GeminiKeyBar({ savedKey, onSave }: { savedKey: string; onSave: (key: string) => void }) {
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);

  // Keep the form's input empty whenever there's no saved key and we're not actively
  // editing (fresh load, or right after "Remove") — otherwise it'd show a stale value.
  useEffect(() => {
    if (!savedKey && !editing) setInput("");
  }, [savedKey, editing]);

  if (savedKey && !editing) {
    return (
      <div className="keybar">
        <span className="k-ok">🔑 Gemini key saved in this browser</span>
        <button className="k-link" onClick={() => { setInput(savedKey); setEditing(true); }}>Change</button>
        <button className="k-link" onClick={() => onSave("")}>Remove</button>
      </div>
    );
  }
  return (
    <form
      className="keybar"
      onSubmit={(e) => { e.preventDefault(); onSave(input.trim()); setEditing(false); }}
    >
      <span className="k-label">🔑 Gemini key (stored only in this browser):</span>
      <input
        type="password"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="AIza…"
        autoComplete="off"
      />
      <button type="submit" disabled={!input.trim()}>Save</button>
      {savedKey && <button type="button" className="k-link" onClick={() => setEditing(false)}>Cancel</button>}
    </form>
  );
}

function downloadHref(mediaUrl: string | undefined, snapshotUrl: string): string {
  return mediaUrl || snapshotUrl;
}

function DownloadLink({ mediaUrl, snapshotUrl }: { mediaUrl?: string; snapshotUrl: string }) {
  const href = downloadHref(mediaUrl, snapshotUrl);
  return (
    <a
      className="dl-btn"
      href={href}
      download
      target="_blank"
      rel="noreferrer"
      title={mediaUrl ? "Download the ad creative" : "No direct file available — opens the Ad Library page"}
    >
      ⬇ Download
    </a>
  );
}

function SavedAdCard({ ad, onUnsave }: { ad: SavedAd; onUnsave: () => void }) {
  return (
    <div className="saved-ad">
      <div className="body">
        <div className="top">
          <span className="brand">{ad.brand}</span>
          <span className="origin">{ad.origin === "astrology-brands" ? "Astrology brands" : "Competitor spy"}</span>
        </div>
        <div className="hook">&ldquo;{ad.hook}&rdquo;</div>
        <div className="date">Started {ad.startDate}</div>
      </div>
      <div className="actions">
        <button className="save-btn saved" onClick={onUnsave}>★ Unsave</button>
        <DownloadLink mediaUrl={ad.mediaUrl} snapshotUrl={ad.snapshotUrl} />
        <a className="plink" href={ad.snapshotUrl} target="_blank" rel="noreferrer">▶ Open →</a>
      </div>
    </div>
  );
}

function SavedList({ saved, toggle }: { saved: SavedAd[]; toggle: (ad: SavedAd) => void }) {
  return (
    <>
      <div className="spy-count"><b>{saved.length}</b> saved ad{saved.length !== 1 ? "s" : ""} · your swipe file, shared across every tab (stored in this browser)</div>
      {saved.length === 0
        ? <div className="excluded-note">No saved ads yet. Hit ☆ Save on any ad to build your swipe file.</div>
        : saved.map((a) => <SavedAdCard key={a.libraryId} ad={a} onUnsave={() => toggle(a)} />)}
    </>
  );
}

// ---------- competitor spy: ad list + leaderboards ----------
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

function spyAdToSaved(a: SpyResult["ads"][number]): SavedAd {
  return { libraryId: a.libraryId, brand: a.brand, hook: a.hook, snapshotUrl: a.snapshotUrl, startDate: a.startDate, origin: "competitor-spy", mediaUrl: a.mediaUrl };
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
          <DownloadLink mediaUrl={a.mediaUrl} snapshotUrl={a.snapshotUrl} />
          <a className="plink" href={a.snapshotUrl} target="_blank" rel="noreferrer">▶ Play / open →</a>
        </span>
      </div>
    </div>
  );
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

const SEVEN_HOURS_MS = 7 * 60 * 60 * 1000;

function SpyTab() {
  const [input, setInput] = useState("");
  const [data, setData] = useState<SpyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"search" | "saved">("search");
  const queryRef = useRef("");
  const { saved, isSaved, toggle } = useSavedAds();

  const run = useCallback(async (query: string, force = false) => {
    queryRef.current = query;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spy?q=${encodeURIComponent(query)}${force ? "&sync=1" : ""}&t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }, []);
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
        <b>Competitor spy.</b> Search a category (divorce, ex back, marriage, cheating, astrology…) to see the real ads brands are running for it — hooks, angles, formats, funnels, ranked oldest-first (proven winners on top).
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
        <SavedList saved={saved} toggle={toggle} />
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
                      <SpyAdRow key={a.libraryId} a={a} oldest={i === 0} saved={isSaved(a.libraryId)} onToggleSave={() => toggle(spyAdToSaved(a))} />
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

// ---------- astrology sandbox → brand radar ----------
function brandGradient(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `linear-gradient(135deg, hsl(${h % 360} 62% 42%), hsl(${(h + 55) % 360} 66% 32%))`;
}
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="#fff"><path d="M4 2.5v11l9-5.5z" /></svg>
);

function brandAdToSaved(brand: string, ad: BrandsData["brands"][number]["ads"][number]): SavedAd {
  return { libraryId: ad.libraryId, brand, hook: ad.hook, snapshotUrl: ad.snapshotUrl, startDate: ad.startDate, origin: "astrology-brands", mediaUrl: ad.mediaUrl };
}

function AdTile({
  brand, ad, oldest, saved, onToggleSave,
}: {
  brand: string;
  ad: BrandsData["brands"][number]["ads"][number];
  oldest: boolean;
  saved: boolean;
  onToggleSave: () => void;
}) {
  return (
    <div className="ad-tile">
      <a className="ad-thumb-link" href={ad.snapshotUrl} target="_blank" rel="noreferrer" title="Play in Meta Ad Library">
        <div className="ad-thumb" style={{ background: brandGradient(ad.libraryId) }}>
          {oldest && <span className="badge-old">oldest</span>}
          <span className="play"><PlayIcon /></span>
          {ad.mediaType === "video" && ad.durationSec && (
            <span className="dur">{Math.floor(ad.durationSec / 60)}:{String(ad.durationSec % 60).padStart(2, "0")}</span>
          )}
        </div>
      </a>
      <div className="hook">{ad.hook}</div>
      <div className="tile-foot">
        <span className="started">Started {ad.startDate}</span>
        <span className="tile-actions">
          <a className="dl-icon" href={downloadHref(ad.mediaUrl, ad.snapshotUrl)} download target="_blank" rel="noreferrer" title="Download">⬇</a>
          <button className={`save-btn ${saved ? "saved" : ""}`} onClick={onToggleSave} title={saved ? "Unsave" : "Save"}>{saved ? "★" : "☆"}</button>
        </span>
      </div>
    </div>
  );
}

function BrandCardView({ b, isSaved, toggle }: { b: BrandsData["brands"][number]; isSaved: (id: string) => boolean; toggle: (ad: SavedAd) => void }) {
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
        {b.ads.map((ad, i) => (
          <AdTile
            key={ad.libraryId}
            brand={b.brand}
            ad={ad}
            oldest={i === 0}
            saved={isSaved(ad.libraryId)}
            onToggleSave={() => toggle(brandAdToSaved(b.brand, ad))}
          />
        ))}
      </div>
    </div>
  );
}

function BrandRadarTab() {
  const [data, setData] = useState<BrandsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shuffled, setShuffled] = useState(false);
  const [view, setView] = useState<"browse" | "saved">("browse");
  const { saved, isSaved, toggle } = useSavedAds();

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
        <button className={`btn ${view === "browse" ? "on" : ""}`} onClick={() => setView("browse")}>Browse</button>
        <button className={`btn ${view === "saved" ? "on" : ""}`} onClick={() => setView("saved")}>⭐ Saved ({saved.length})</button>
        {view === "browse" && (
          <>
            <button className="btn" onClick={() => load(true)} disabled={loading}>
              {loading ? "Shuffling…" : "🔀 Shuffle brands & ads"}
            </button>
            {shuffled && (
              <button className="btn" onClick={() => load(false)} disabled={loading}>↺ Back to oldest-first</button>
            )}
          </>
        )}
      </div>
      {view === "saved"
        ? <SavedList saved={saved} toggle={toggle} />
        : data.brands.map((b) => <BrandCardView key={b.brand} b={b} isSaved={isSaved} toggle={toggle} />)}
    </>
  );
}

// ---------- Reddit / Quora / Web: top-5 reshufflable stories ----------
const PLATFORM_META: Record<Platform, { icon: string; label: string; hint: string }> = {
  reddit: { icon: "👽", label: "Reddit", hint: "real Reddit threads and comments" },
  quora: { icon: "❓", label: "Quora", hint: "real Quora questions and answers" },
  web: { icon: "🌐", label: "the web", hint: "news, blogs, and articles" },
};

function StoryCard({ story, rank }: { story: PlatformResult["stories"][number]; rank: number }) {
  return (
    <div className="story-card">
      <div className="story-rank">#{rank}</div>
      <div className="story-body">
        {story.url ? (
          <a className="story-title" href={story.url} target="_blank" rel="noreferrer">{story.title}</a>
        ) : (
          <div className="story-title plain">{story.title}</div>
        )}
        {story.summary && <div className="story-sum">{story.summary}</div>}
        {story.source && <div className="story-src">{story.source}</div>}
      </div>
    </div>
  );
}

function PlatformTab({ platform }: { platform: Platform }) {
  const meta = PLATFORM_META[platform];
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<PlatformResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { key: geminiKey, setKey: setGeminiKey } = useLocalGeminiKey();

  const run = useCallback(async (q: string, shuffle = false, keyOverride?: string) => {
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    setError(null);
    try {
      const activeKey = keyOverride ?? geminiKey;
      const res = await fetch(`/api/research?platform=${platform}&q=${encodeURIComponent(q)}${shuffle ? "&shuffle=1" : ""}&t=${Date.now()}`, {
        cache: "no-store",
        headers: activeKey ? { "x-gemini-api-key": activeKey } : undefined,
      });
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }, [platform, geminiKey]);

  const saveGeminiKey = (next: string) => {
    setGeminiKey(next);
    if (query) run(query, false, next);
  };

  const search = (q: string) => { setInput(q); run(q); };

  return (
    <>
      <div className="banner live">
        <b>{meta.icon} {meta.label} stories.</b> Search a keyword to see the top 5 real, current stories about it from {meta.hint} — click 🔀 Reshuffle anytime for a fresh set.
      </div>

      <GeminiKeyBar savedKey={geminiKey} onSave={saveGeminiKey} />

      <form className="spy-search" onSubmit={(e) => { e.preventDefault(); run(input); }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Search a keyword — e.g. divorce, ex back, marriage, cheating…`}
        />
        <button type="submit">Search</button>
      </form>

      <div className="chips" style={{ marginBottom: 4 }}>
        {CATEGORY_CHIPS.map((s) => (
          <button key={s} className={`chip ${query === s ? "active" : ""}`} onClick={() => search(s)}>{s}</button>
        ))}
      </div>

      {loading && <div className="loading">Finding top stories…</div>}
      {error && <div className="error">⚠️ {error}</div>}

      {data && !loading && (
        <>
          {data.source !== "gemini" ? (
            <div className="excluded-note">{data.note}</div>
          ) : (
            <>
              <div className="spy-count" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Top {data.stories.length || 0} stories for &ldquo;<b>{data.topic}</b>&rdquo; on {meta.label}</span>
                <button className="btn" onClick={() => run(data.topic, true)} disabled={loading}>🔀 Reshuffle</button>
              </div>
              {data.stories.length === 0 ? (
                <div className="excluded-note">No stories found for &ldquo;{data.topic}&rdquo; on {meta.label}. Try Reshuffle or a different keyword.</div>
              ) : (
                <div className="story-list">
                  {data.stories.map((s, i) => <StoryCard key={i} story={s} rank={i + 1} />)}
                </div>
              )}
            </>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="excluded-note">Search a keyword above (or tap a chip) to see the top 5 {meta.label} stories.</div>
      )}
    </>
  );
}

// ---------- shell ----------
const TABS: { id: Tab; label: string }[] = [
  { id: "persona", label: "🔮 Astrology brands" },
  { id: "competitors", label: "🔎 Competitor spy" },
  { id: "reddit", label: "👽 Reddit" },
  { id: "quora", label: "❓ Quora" },
  { id: "web", label: "🌐 Web" },
];

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("persona");
  return (
    <div className="wrap">
      <a
        className="feedback-badge"
        href="mailto:anushka.rathore@astrotalk.com?subject=Astro%20Marketing%20Intelligence%20feedback"
        target="_blank"
        rel="noreferrer"
      >
        <div className="fb-title">🚧 Still building!</div>
        <div className="fb-sub">Have suggestions? <span className="fb-link">Tell Anushka</span></div>
      </a>

      <header className="top">
        <div>
          <h1>🔮 Astro Marketing Intelligence</h1>
          <p>Competitor creative · live market demand — one view</p>
        </div>
      </header>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === "persona" && <BrandRadarTab />}
      {tab === "competitors" && <SpyTab />}
      {tab === "reddit" && <PlatformTab platform="reddit" />}
      {tab === "quora" && <PlatformTab platform="quora" />}
      {tab === "web" && <PlatformTab platform="web" />}

      <div className="footnote">
        <b>Astrology brands</b> and <b>Competitor spy</b> show real ads (☆ save, ⬇ download on every ad). <b>Reddit / Quora / Web</b> each show the top 5 live stories for your keyword — 🔀 Reshuffle for a new set anytime.
      </div>
    </div>
  );
}
