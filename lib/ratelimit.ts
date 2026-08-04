// Lightweight in-memory, per-IP sliding-window rate limiter.
//
// Purpose: the public API routes /api/spy and /api/research spend the owner's
// PAID third-party credits (ScrapeCreators / Gemini). Without a gate, anyone who
// finds the public URL could hammer them and drain the account ("denial of
// wallet"). This caps requests per IP so casual abuse can't run up a bill.
//
// Runs in the single persistent Node process (Railway `next start`), so the
// in-memory state is shared across all requests. Fails OPEN on any internal
// error so a limiter bug can never take the app down.

const WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX = 30; // requests per window per IP

const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export interface RateResult {
  ok: boolean;
  retryAfter: number; // seconds until the caller may retry
}

export function rateLimit(ip: string, max = DEFAULT_MAX, windowMs = WINDOW_MS): RateResult {
  try {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      hits.set(ip, recent);
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - recent[0]!)) / 1000));
      return { ok: false, retryAfter };
    }

    recent.push(now);
    hits.set(ip, recent);

    // Opportunistic prune so the Map can't grow unbounded.
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (v.every((t) => now - t >= windowMs)) hits.delete(k);
      }
    }
    return { ok: true, retryAfter: 0 };
  } catch {
    return { ok: true, retryAfter: 0 }; // fail open
  }
}
