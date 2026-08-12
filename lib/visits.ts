// Logs each app visit as a row in the "VisitsSpy" Google Sheet tab, via an
// Apps Script Web App webhook (no Google Cloud service account needed).
//
// Never breaks the app: if the webhook URL isn't configured, the request
// times out, or the sheet is unreachable, this fails silently.

const TIMEOUT_MS = 3000;

export interface VisitInfo {
  email?: string | null;
  ip?: string;
  userAgent?: string;
}

// SECURITY: userAgent/ip come from client-controlled HTTP headers, so an
// attacker can set User-Agent to a string like "=IMPORTXML(...)". Google
// Sheets treats a cell starting with =/+/-/@ as a formula, which is a known
// "spreadsheet formula injection" vector (can exfiltrate data or call out to
// attacker URLs when the sheet is later opened). Prefix any such value with
// a leading apostrophe so Sheets always renders it as literal text, and cap
// length so one hostile request can't bloat the sheet.
function sanitizeCell(v: string): string {
  const trimmed = v.slice(0, 500);
  return /^[=+\-@]/.test(trimmed) ? `'${trimmed}` : trimmed;
}

export async function logVisit(info: VisitInfo): Promise<void> {
  const url = process.env.VISITS_WEBHOOK_URL;
  if (!url) return;

  const payload = {
    timestamp: new Date().toISOString(),
    email: sanitizeCell(info.email || ""),
    ip: sanitizeCell(info.ip || ""),
    userAgent: sanitizeCell(info.userAgent || ""),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // Sheet down, webhook redeployed, network hiccup — never surface this to the user.
  } finally {
    clearTimeout(timer);
  }
}
