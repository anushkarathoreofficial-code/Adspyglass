import { NextResponse } from "next/server";
import { loadSeedAds } from "@/lib/seed";
import { PERSONA } from "@/lib/persona";
import type { PersonaData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { ads, country, harvestedAt } = loadSeedAds();
  ads.sort((a, b) => b.personaFit.score - a.personaFit.score);

  const data: PersonaData & { persona: typeof PERSONA } = {
    generatedAt: new Date().toISOString(),
    source: "ad-library-harvest",
    country,
    harvestedAt,
    ads,
    persona: PERSONA,
  };
  return NextResponse.json(data);
}
