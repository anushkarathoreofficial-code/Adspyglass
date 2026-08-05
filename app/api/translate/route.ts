import { NextResponse } from "next/server";
import { translateBatch } from "@/lib/translate";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const rl = rateLimit(clientIp(req));
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  let body: { texts?: unknown; to?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const texts = Array.isArray(body.texts) ? body.texts.filter((t): t is string => typeof t === "string") : [];
  const to = typeof body.to === "string" && /^[a-z]{2}$/i.test(body.to) ? body.to : "en";
  return NextResponse.json(await translateBatch(texts, to));
}
