import { NextResponse } from "next/server";
import { spySearch } from "@/lib/spy";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Mirrors the country picker in the UI (app/Dashboard.tsx COUNTRIES). Validating
// server-side too means a request can't smuggle an arbitrary value through to
// the upstream provider's `country` parameter.
const ALLOWED_COUNTRIES = new Set(["US", "IN", "DE", "GB", "FR", "ES", "IT", "BR", "MX", "CA", "AU", "AE"]);

export async function GET(req: Request) {
  const rl = rateLimit(clientIp(req));
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const sp = new URL(req.url).searchParams;
  const q = sp.get("q") ?? "";
  const force = sp.get("sync") === "1";
  const cursor = sp.get("cursor") || undefined;
  const countryParam = (sp.get("country") || "US").toUpperCase();
  const country = ALLOWED_COUNTRIES.has(countryParam) ? countryParam : "US";
  return NextResponse.json(await spySearch(q, force, cursor, country));
}
