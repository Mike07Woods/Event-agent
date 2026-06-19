// analyzer.js — Scores each raw event and attaches actionable metadata.
// Each event receives a numeric score (1–10), a priority label, a topic tag,
// and a "how to capitalize" note that tells you the single best action to take.

// ─── Scoring weights (must sum to 10) ───────────────────────────────────────
const WEIGHTS = {
  relevance: 4,    // Is the topic directly relevant to our focus areas?
  proximity: 3,    // How soon is the event?
  location:  2,    // Is it in Egypt or online?
  opportunity: 1,  // What type of value does it offer?
};

// ─── Keywords that signal a high-relevance topic ─────────────────────────────
const HIGH_RELEVANCE_KEYWORDS = [
  "saas", "software as a service", "call center", "call centre",
  "bpo", "business process outsourcing", "contact center", "crm",
  "customer success", "help desk", "tech hiring", "talent acquisition",
];

const MEDIUM_RELEVANCE_KEYWORDS = [
  "business networking", "startup", "entrepreneur", "fintech",
  "hr", "human resources", "recruitment", "workforce", "digital transformation",
  "cloud", "automation", "ai", "artificial intelligence",
];

// ─── Score topic relevance (0–4) ─────────────────────────────────────────────
function score_relevance(event) {
  const text = `${event.name} ${event.description} ${event.query}`.toLowerCase();

  const is_high   = HIGH_RELEVANCE_KEYWORDS.some((kw) => text.includes(kw));
  const is_medium = MEDIUM_RELEVANCE_KEYWORDS.some((kw) => text.includes(kw));

  if (is_high)   return { score: WEIGHTS.relevance, topic: detect_topic(text) };
  if (is_medium) return { score: 2, topic: detect_topic(text) };
  return { score: 1, topic: "General Business" };
}

// Identify the primary topic label for the card badge
function detect_topic(text) {
  if (/saas|software as a service/.test(text)) return "SaaS";
  if (/call cent(er|re)|contact cent(er|re)/.test(text)) return "Call Center";
  if (/bpo|business process/.test(text)) return "BPO";
  if (/hiring|recruitment|talent|hr|human resources/.test(text)) return "Hiring";
  if (/networking/.test(text)) return "Networking";
  if (/fintech/.test(text)) return "FinTech";
  if (/startup|entrepreneur/.test(text)) return "Startup";
  return "Business";
}

// ─── Score date proximity (0–3): sooner = higher ─────────────────────────────
function score_proximity(event) {
  const now = new Date();

  // Try to parse the event date; many will be approximate strings
  const parsed = parse_fuzzy_date(event.date);
  if (!parsed) return 1; // unknown date → neutral score

  const days_away = (parsed - now) / (1000 * 60 * 60 * 24);

  if (days_away < 0)   return 0;   // already passed
  if (days_away <= 30) return WEIGHTS.proximity;   // within a month → max
  if (days_away <= 90) return 2;   // within 3 months
  if (days_away <= 180) return 1;  // within 6 months
  return 0;                         // far out
}

// Convert fuzzy date strings to a Date object (best-effort)
function parse_fuzzy_date(date_str) {
  if (!date_str || date_str === "Date TBD") return null;

  // Strip ranges: "June 10–12, 2026" → "June 10, 2026"
  const cleaned = date_str.replace(/[–-]\d{1,2}/, "");

  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// ─── Score location fit (0–2) ────────────────────────────────────────────────
function score_location(event) {
  const loc = event.location.toLowerCase();
  if (loc.includes("egypt") || loc.includes("cairo")) return WEIGHTS.location;
  if (loc === "online")                               return 1;
  return 0; // other physical locations score lowest
}

// ─── Score opportunity type (0–1) ────────────────────────────────────────────
const OPPORTUNITY_KEYWORDS = {
  speaking:   ["speaker", "keynote", "speak", "submit abstract", "call for speakers"],
  hiring:     ["hiring", "job fair", "career", "recruit", "talent"],
  networking: ["networking", "meet", "connect", "expo", "conference"],
  learning:   ["workshop", "training", "seminar", "webinar", "learn", "certification"],
};

function score_opportunity(event) {
  const text = `${event.name} ${event.description}`.toLowerCase();
  for (const [type, keywords] of Object.entries(OPPORTUNITY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return { score: WEIGHTS.opportunity, opportunity_type: type };
    }
  }
  return { score: 0, opportunity_type: "general" };
}

// ─── Generate an actionable "how to capitalize" note ─────────────────────────
function build_capitalize_note(event, opportunity_type, topic) {
  const date_hint = event.date !== "Date TBD" ? ` before ${event.date}` : "";
  const is_egypt  = event.location.toLowerCase().includes("egypt");

  // Speaking opportunity → push speaker application
  if (opportunity_type === "speaking") {
    return `Submit a speaker application${date_hint} to position your company as a thought leader on BPO/SaaS.`;
  }

  // Hiring event → source talent
  if (opportunity_type === "hiring") {
    return `Attend to source call-center and operations talent; bring branded hiring materials.`;
  }

  // SaaS or BPO expo in Egypt → supplier/partner meetings
  if ((topic === "SaaS" || topic === "BPO" || topic === "Call Center") && is_egypt) {
    return `Book 3+ meetings with decision-makers and bring your capability deck.`;
  }

  // Online networking → low-cost lead gen
  if (event.location === "Online" && opportunity_type === "networking") {
    return `Register early and join breakout rooms — introduce your company to 5+ prospects in virtual sessions.`;
  }

  // Learning / workshop → skill up the team
  if (opportunity_type === "learning") {
    return `Enroll 1–2 team leads to upskill and report back actionable takeaways.`;
  }

  // General Egypt event → presence and visibility
  if (is_egypt) {
    return `Attend to build local visibility; exchange contacts with organizers for follow-up.`;
  }

  // Generic fallback
  return `Monitor registrations, attend virtually, and follow up with speakers/sponsors afterward.`;
}

// ─── Main export: analyze a list of raw events ───────────────────────────────
export function analyze_events(raw_events) {
  console.log(`\n🧠 Analyzing ${raw_events.length} events...`);

  return raw_events.map((event) => {
    const relevance_result   = score_relevance(event);
    const proximity_score    = score_proximity(event);
    const location_score     = score_location(event);
    const opportunity_result = score_opportunity(event);

    // Clamp total score to 1–10
    const total = Math.min(
      10,
      Math.max(
        1,
        relevance_result.score +
          proximity_score +
          location_score +
          opportunity_result.score
      )
    );

    // Assign priority label from score thresholds
    const priority =
      total >= 7 ? "High" :
      total >= 4 ? "Medium" :
                   "Low";

    const capitalize_note = build_capitalize_note(
      event,
      opportunity_result.opportunity_type,
      relevance_result.topic
    );

    return {
      ...event,
      score:            total,
      priority,
      topic:            relevance_result.topic,
      opportunity_type: opportunity_result.opportunity_type,
      capitalize_note,
    };
  });
}
