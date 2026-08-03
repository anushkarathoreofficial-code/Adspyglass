import { NextResponse } from "next/server";
import { loadBrands } from "@/lib/brands";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const randomize = new URL(req.url).searchParams.get("shuffle") === "1";
  return NextResponse.json(loadBrands(randomize));
}
