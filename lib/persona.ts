// ---------------------------------------------------------------------------
// Persona engine — "The Emotionally Overloaded Meaning Seeker" (US)
//
// Operationalizes the persona brief into a scorer that rates any ad's COPY on
// how well it speaks this persona's emotional language, checks the five
// converting moves, and flags the clichés the persona rejects.
// ---------------------------------------------------------------------------

export interface ConvertingMove {
  key: string;
  label: string;
  desc: string;
  present: boolean;
}

export interface PersonaFit {
  score: number; // 0-100
  verdict: "Strong match" | "Partial match" | "Weak match" | "Off-persona";
  converting: ConvertingMove[]; // the 5-point "what makes them convert" checklist
  signals: string[]; // persona-language categories detected
  painPoints: string[]; // which ranked pains this ad targets
  redFlags: string[]; // rejected clichés present (persona tunes these out)
}

// The five converting moves (from "What Makes Them Convert").
const MOVES: { key: string; label: string; desc: string; re: RegExp }[] = [
  {
    key: "emotional-moment",
    label: "Real emotional moment",
    desc: "Opens in a felt scene (crying in the car, 2 AM, couldn't sleep)",
    re: /crying|in (my|the) car|\b[23] ?a\.?m\.?|late[- ]?night|couldn'?t sleep|broke down|felt (lost|so alone)|rock bottom|breaking point|at my lowest/i,
  },
  {
    key: "skepticism",
    label: "Acknowledges skepticism",
    desc: "Mirrors the customer's own doubt (I didn't believe / I was embarrassed)",
    re: /didn'?t believe|was skeptical|thought .{0,25}(fake|scam|nonsense)|embarrassed|never thought i'?d|don'?t usually|i'?m not the type|still (shook|shocked)|i'?m still shook/i,
  },
  {
    key: "turning-point",
    label: "Specific turning point",
    desc: "One concrete moment things changed, not vague magic",
    re: /one (chat|call|reading|conversation|message)|changed everything|the moment|that'?s when|turning point|within minutes|first \d+ minutes/i,
  },
  {
    key: "concrete-proof",
    label: "Concrete, personalized proof",
    desc: "She knew the exact name/initials; hard numbers, real reviews",
    re: /\b(knew|nailed|told|predicted|revealed|said|called out)\b.{0,25}(exact|name|initial|date)|initials|name start|without me (saying|telling)|\b9\.\d ?\/ ?10|\d[\d,]{2,}\+? ?(reviews|women|customers|people)|trustpilot|accura(te|cy)/i,
  },
  {
    key: "low-risk-cta",
    label: "Low-risk next step",
    desc: "First minutes free / $1 / no-risk trial removes pricing anxiety",
    re: /first \d+ ?(min|minutes) free|first chat free|free reading|no[- ]?risk|risk[- ]?free|\$1\b|\bcompletely free|try (it )?(for )?free/i,
  },
];

// Persona-language categories (positive signal beyond the 5 moves).
const SIGNALS: { key: string; label: string; weight: number; re: RegExp; pains: string[] }[] = [
  {
    key: "pattern",
    label: "Pattern recognition",
    weight: 16,
    re: /why do i (always|keep)|keep attracting|same pattern|keeps happening|why do i repeat|repeat this|see what you can'?t|connect the dots|always attract/i,
    pains: ["Repeating relationship patterns", "Feeling misunderstood"],
  },
  {
    key: "meaning",
    label: "Meaning / explanation (not reassurance)",
    weight: 12,
    re: /why is this happening|make sense of|what am i missing|what.{0,12}lesson|understand why|answers you deserve|clarity|closure|why (did|does)/i,
    pains: ["Emotional uncertainty", "Identity confusion", "Purpose"],
  },
  {
    key: "relationship",
    label: "Relationship uncertainty",
    weight: 15,
    re: /will he come back|come back|did he (love|ever)|\bex\b|situationship|ghosted|mixed signals|his intentions|should i (move on|stay|leave)|move on|let go|right person|questioning (the|your|whether)|unsure (whether|if)|\bdoubts?\b|suspicious|affair|cheat(ing|ed)?|boyfriend|girlfriend|\bpartner\b|marriage|is he (the one|cheating)|the one|soulmate|second[- ]?guess|future holds|not sure what.{0,20}future|love[- ]?life/i,
    pains: ["Repeating relationship patterns", "Loneliness", "Emotional uncertainty"],
  },
  {
    key: "career",
    label: "Career direction",
    weight: 8,
    re: /should i quit|wrong (path|career)|was.{0,12}a sign|which (path|direction)|start my business|change careers|on the wrong/i,
    pains: ["Career direction", "Life timing"],
  },
  {
    key: "validation",
    label: "Validation / permission",
    weight: 11,
    re: /you'?re not (crazy|imagining|alone)|not imagining|it wasn'?t (random|your fault)|permission|finally saw (me|them|you)|someone who (gets|sees) you|not your fault|you deserve|see what you can'?t/i,
    pains: ["Self-doubt", "Feeling misunderstood"],
  },
  {
    key: "human-not-ai",
    label: "Human, not AI (trust)",
    weight: 10,
    re: /real (human )?psychic|never ai|no ai|not (a )?bot|real (humans?|people)|human (psychic|reader|judgment|insight)/i,
    pains: ["Self-doubt"],
  },
];

// Clichés the persona explicitly rejects (negative + surfaced as warnings).
const RED_FLAGS: { label: string; re: RegExp }[] = [
  { label: '"Unlock your destiny"', re: /unlock your (destiny|potential)|destiny awaits/i },
  { label: '"The universe has a message"', re: /the universe (has|wants|is)|message from the universe/i },
  { label: '"Manifest abundance"', re: /manifest (abundance|your)|attract abundance|abundance flows/i },
  { label: "Overly mystical / cosmic clichés", re: /cosmic blueprint|soul frequency|raise your vibration|align your (chakra|energy)|divine timing/i },
  { label: "AI pretending to replace human intuition", re: /custom[- ]?coded ai|ai (strategist|psychic|reader|astrologer|coach)|powered by ai|ai[- ]?driven reading/i },
];

const RED_FLAG_PENALTY = 12;

export function scorePersonaFit(text: string): PersonaFit {
  const t = text || "";

  const converting: ConvertingMove[] = MOVES.map((m) => ({
    key: m.key,
    label: m.label,
    desc: m.desc,
    present: m.re.test(t),
  }));
  const movesHit = converting.filter((c) => c.present).length;

  const signals: string[] = [];
  const painSet = new Set<string>();
  let signalPts = 0;
  for (const s of SIGNALS) {
    if (s.re.test(t)) {
      signals.push(s.label);
      signalPts += s.weight;
      s.pains.forEach((p) => painSet.add(p));
    }
  }

  const redFlags = RED_FLAGS.filter((r) => r.re.test(t)).map((r) => r.label);

  // Converting moves are the core: each is worth up to 14 (max 70), signals add
  // colour (capped 30), red flags subtract.
  const movePts = movesHit * 14;
  let score = Math.min(70, movePts) + Math.min(30, signalPts) - redFlags.length * RED_FLAG_PENALTY;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const verdict: PersonaFit["verdict"] =
    score >= 65 ? "Strong match" : score >= 40 ? "Partial match" : score >= 18 ? "Weak match" : "Off-persona";

  return { score, verdict, converting, signals, painPoints: [...painSet], redFlags };
}

// Persona brief for the UI (verbatim to the source framework).
export const PERSONA = {
  name: "The Emotionally Overloaded Meaning Seeker",
  who: "26–42 · ~80% female · US suburban/urban · $45k–120k · single, situationship, divorced or uncertain relationship",
  coreInsight:
    "They're not buying astrology — they're buying certainty during emotional uncertainty. What they cannot tolerate is meaninglessness. That is what they pay to remove.",
  buys: ["Hope", "Validation", "Clarity", "Direction", "Closure", "Permission", "Meaning", "Certainty"],
  convertingMoves: MOVES.map((m) => ({ label: m.label, desc: m.desc })),
  rejects: [
    '"Unlock your destiny"',
    '"The universe has a message"',
    '"Manifest abundance"',
    "Generic zodiac clichés",
    "Overly mystical branding",
    "AI pretending to replace human intuition",
  ],
  topPains: [
    "Repeating relationship patterns",
    "Feeling misunderstood",
    "Loneliness",
    "Emotional uncertainty",
    "Anxiety",
    "Self-doubt",
    "Career direction",
    "Life timing",
    "Identity confusion",
    "Purpose",
  ],
};
