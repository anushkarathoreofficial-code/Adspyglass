import { NextResponse } from "next/server";
import { loadBrandsLive } from "@/lib/brandsLive";
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
  const randomize = new URL(req.url).searchParams.get("shuffle") === "1";
  return NextResponse.json(await loadBrandsLive(randomize));
}
