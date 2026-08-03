import { NextResponse } from "next/server";
import { buildDtcDashboard } from "@/lib/dtc";
import { PERSONA } from "@/lib/persona";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = buildDtcDashboard();
  return NextResponse.json({ ...data, persona: PERSONA });
}
