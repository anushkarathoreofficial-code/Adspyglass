import { NextResponse } from "next/server";
import { researchTopic } from "@/lib/research";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const clientKey = req.headers.get("x-gemini-api-key") ?? undefined;
  return NextResponse.json(await researchTopic(q, clientKey));
}
