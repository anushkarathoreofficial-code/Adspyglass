import { NextResponse } from "next/server";
import accountsCfg from "@/config/accounts.json";
import { fetchAccountPerf, usingMarketingApi } from "@/lib/marketing";
import type { AccountsData, OwnAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = accountsCfg as { datePreset: string; accounts: OwnAccount[] };
  const accounts = await Promise.all(
    cfg.accounts.map((a) => fetchAccountPerf(a, cfg.datePreset))
  );
  const data: AccountsData = {
    generatedAt: new Date().toISOString(),
    source: usingMarketingApi() ? "marketing-api" : "mock",
    datePreset: cfg.datePreset,
    accounts,
  };
  return NextResponse.json(data);
}
