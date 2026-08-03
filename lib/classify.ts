import type { AdAngle } from "./types";

const RULES: { angle: AdAngle; keywords: string[] }[] = [
  { angle: "Kundli & Matchmaking", keywords: ["kundli", "matchmaking", "match your", "janam", "marriage", "shaadi"] },
  { angle: "Tarot", keywords: ["tarot"] },
  { angle: "Love & Relationships", keywords: ["love", "relationship", "ex", "partner", "breakup", "confused about love"] },
  { angle: "Career & Money", keywords: ["career", "job", "money", "business", "finance", "wealth", "promotion"] },
  { angle: "Horoscope", keywords: ["horoscope", "rashi", "zodiac", "stars say", "2026", "daily prediction"] },
  { angle: "Free Trial / Offer", keywords: ["free", "first chat", "₹", "offer", "discount", "trial"] },
  { angle: "Remedies & Puja", keywords: ["remedy", "remedies", "puja", "pooja", "upay", "gemstone", "mantra"] },
];

/** Rule-based angle classification from ad body text. First match wins by rule order. */
export function classifyAngle(text: string): AdAngle {
  const t = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => t.includes(k))) return rule.angle;
  }
  return "General / Trust";
}
