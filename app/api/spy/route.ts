import { NextResponse } from "next/server";
import { spySearch } from "@/lib/spy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q") ?? "";
  const force = sp.get("sync") === "1";
  return NextResponse.json(await spySearch(q, force));
}
