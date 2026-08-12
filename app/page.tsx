import { headers } from "next/headers";
import { auth } from "@/auth";
import { logVisit } from "@/lib/visits";
import Dashboard from "./Dashboard";

export default async function Home() {
  const session = await auth();
  const h = await headers();
  await logVisit({
    email: session?.user?.email,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined,
    userAgent: h.get("user-agent") || undefined,
  });
  return <Dashboard userEmail={session?.user?.email ?? null} />;
}
