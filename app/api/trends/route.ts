import { NextResponse } from "next/server";
import competitors from "@/config/competitors.json";
import { fetchTrends } from "@/lib/trends";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = competitors as { country: string };
  const data = await fetchTrends(cfg.country);
  return NextResponse.json(data);
}
