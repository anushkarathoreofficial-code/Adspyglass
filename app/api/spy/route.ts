import { NextResponse } from "next/server";
import { spySearch } from "@/lib/spy";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

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
  const country = sp.get("country") || "US";
  return NextResponse.json(await spySearch(q, force, cursor, country));
}
