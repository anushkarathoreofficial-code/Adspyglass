"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrandsData, PlatformFindings, SavedAd, SpyResult, TopicResearch } from "@/lib/types";

type Tab = "persona" | "competitors";

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
      <span className="k-label">🔑 Gemini key (stored only in this browser, sent only with your research requests):</span>
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
  return { libraryId: a.libraryId, brand: a.brand, hook: a.hook, snapshotUrl: a.snapshotUrl, startDate: a.startDate, origin: "competitor-spy" };
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

// ---------- live trend research: Reddit · Quora · Web ----------
const PLATFORM_META = {
  reddit: { icon: "👽", label: "Reddit" },
  quora: { icon: "❓", label: "Quora" },
  web: { icon: "🌐", label: "Web" },
} as const;

function PlatformCard({ platform, data }: { platform: keyof typeof PLATFORM_META; data: PlatformFindings }) {
  const meta = PLATFORM_META[platform];
  const groups: { title: string; items: string[]; cls?: string }[] = [
    { title: "Pain points", items: data.painPoints },
    { title: "Real phrases", items: data.phrases, cls: "phrase" },
    { title: "Top questions", items: data.questions },
    { title: "Angles to try", items: data.angles },
  ];
  const isEmpty = !data.summary && groups.every((g) => g.items.length === 0);
  return (
    <div className="rcard">
      <div className="rtitle">{meta.icon} {meta.label}</div>
      {data.note && <div className="rempty">{data.note}</div>}
      {data.summary && <div className="rsum">{data.summary}</div>}
      {isEmpty && !data.note && <div className="rempty">No findings for this platform.</div>}
      {groups.map((g) => g.items.length > 0 && (
        <div key={g.title}>
          <h6>{g.title}</h6>
          <ul className={g.cls}>{g.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      ))}
      {data.sources.length > 0 && (
        <div className="rsrc">
          {data.sources.map((s, i) => <a key={i} href={s.url} target="_blank" rel="noreferrer">🔗 {s.title || new URL(s.url).hostname}</a>)}
        </div>
      )}
    </div>
  );
}

function ResearchPanel({ r, loading }: { r: TopicResearch | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="research">
        <div className="rhead"><h3>Live trend research</h3></div>
        <div className="rnote-wrap"><div className="rnote">Researching Reddit, Quora, and the web right now…</div></div>
      </div>
    );
  }
  if (!r) return null;
  if (r.source !== "gemini") {
    return (
      <div className="research">
        <div className="rhead"><h3>Live trend research</h3></div>
        <div className="rnote-wrap"><div className="rnote">{r.note}</div></div>
      </div>
    );
  }
  return (
    <div className="research">
      <div className="rhead">
        <h3>Live trend research</h3>
        <span className="live-dot">● live · &ldquo;{r.topic}&rdquo;</span>
      </div>
      <div className="research3">
        <PlatformCard platform="reddit" data={r.reddit} />
        <PlatformCard platform="quora" data={r.quora} />
        <PlatformCard platform="web" data={r.web} />
      </div>
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
  const { key: geminiKey, setKey: setGeminiKey } = useLocalGeminiKey();

  const runResearch = useCallback(async (query: string, keyOverride?: string) => {
    if (!query.trim()) { setResearch(null); return; }
    setResearching(true);
    setResearch(null);
    try {
      const activeKey = keyOverride ?? geminiKey;
      const res = await fetch(`/api/research?q=${encodeURIComponent(query)}&t=${Date.now()}`, {
        cache: "no-store",
        headers: activeKey ? { "x-gemini-api-key": activeKey } : undefined,
      });
      setResearch(await res.json());
    } catch (e) {
      const note = e instanceof Error ? e.message : "Research failed";
      const empty = { summary: "", painPoints: [], phrases: [], questions: [], angles: [], sources: [] };
      setResearch({ source: "error", topic: query, reddit: empty, quora: empty, web: empty, note });
    } finally { setResearching(false); }
  }, [geminiKey]);

  const saveGeminiKey = (next: string) => {
    setGeminiKey(next);
    if (queryRef.current) runResearch(queryRef.current, next);
  };

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
        <b>Competitor spy.</b> Search a category (divorce, ex back, marriage, cheating, astrology…) — get <b>live trends</b> from Reddit, Quora, and the web as three separate sections, <i>plus</i> the real ads brands are running for it (hooks, angles, formats, funnels).
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

          <GeminiKeyBar savedKey={geminiKey} onSave={saveGeminiKey} />
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
  return { libraryId: ad.libraryId, brand, hook: ad.hook, snapshotUrl: ad.snapshotUrl, startDate: ad.startDate, origin: "astrology-brands" };
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
        <button className={`save-btn ${saved ? "saved" : ""}`} onClick={onToggleSave} title={saved ? "Unsave" : "Save"}>{saved ? "★" : "☆"}</button>
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

// ---------- shell ----------
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("persona");
  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>🔮 Astro Marketing Intelligence</h1>
          <p>Competitor creative · live market demand — one view</p>
        </div>
      </header>

      <div className="tabs">
        <button className={tab === "persona" ? "active" : ""} onClick={() => setTab("persona")}>🔮 Astrology brands</button>
        <button className={tab === "competitors" ? "active" : ""} onClick={() => setTab("competitors")}>🔎 Competitor spy</button>
      </div>

      {tab === "persona" && <BrandRadarTab />}
      {tab === "competitors" && <SpyTab />}

      <div className="footnote">
        <b>Astrology brands:</b> brand identity + ads oldest-first, shuffle for a new set. <b>Competitor spy:</b> live Reddit / Quora / Web trend research (Gemini) + real ads by category. Save any ad (☆) — your swipe file is shared across both tabs.
      </div>
    </div>
  );
}
