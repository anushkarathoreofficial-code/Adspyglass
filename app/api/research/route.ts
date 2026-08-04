import { NextResponse } from "next/server";
import { fetchStories } from "@/lib/research";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import type { Platform } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID: Platform[] = ["reddit", "quora", "web"];

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q") ?? "";
  const platformParam = sp.get("platform") ?? "web";
  const platform = (VALID.includes(platformParam as Platform) ? platformParam : "web") as Platform;
  const shuffle = sp.get("shuffle") === "1";

  const rl = rateLimit(clientIp(req));
  if (!rl.ok) {
    // Shaped like a PlatformResult so the UI shows the note cleanly.
    return NextResponse.json(
      { source: "error", platform, topic: q, stories: [], note: "Too many requests — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const clientKey = req.headers.get("x-gemini-api-key") ?? undefined;
  return NextResponse.json(await fetchStories(q, platform, clientKey, shuffle));
}
