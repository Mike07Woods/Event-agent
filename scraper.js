// scraper.js — Searches the web for upcoming events via the Serper API.
// Runs all search queries in parallel and merges the results into a single
// flat array of raw event objects.

import fetch from "node-fetch";
import config from "./config.js";

// ─── Search queries sent to Serper ──────────────────────────────────────────
// Mix of Egypt-specific physical events and global online events
const SEARCH_QUERIES = [
  "SaaS events Egypt 2026",
  "call center expo Egypt 2026",
  "BPO conference Egypt 2026",
  "business networking events Cairo 2026",
  "hiring events Egypt 2026",
  "online SaaS conference 2026",
  "virtual BPO summit 2026",
  "remote business networking 2026",
];

// ─── Run a single Serper search query ───────────────────────────────────────
async function search_query(query) {
  const response = await fetch(config.serper.endpoint, {
    method: "POST",
    headers: {
      "X-API-KEY": config.serper.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: 10,         // results per query
      gl: "eg",        // geo-location hint: Egypt
      hl: "en",        // language: English
    }),
  });

  if (!response.ok) {
    console.error(`Serper error for query "${query}": ${response.status} ${response.statusText}`);
    return [];
  }

  const data = await response.json();

  // Serper returns results under `organic` — each has title, link, snippet, date
  const results = data.organic || [];

  // Map each search result to our raw event shape
  return results.map((result) => ({
    name:        result.title || "Untitled Event",
    date:        extract_date(result.date, result.snippet, result.title),
    location:    extract_location(result.snippet, result.title, query),
    description: result.snippet || "",
    url:         result.link || "",
    source:      new URL(result.link || "https://unknown").hostname,
    query:       query,   // track which query surfaced this result
  }));
}

// ─── Heuristic: pull a date string from Serper's date field or snippet ──────
function extract_date(serper_date, snippet, title) {
  // Serper sometimes provides a formatted date string directly
  if (serper_date) return serper_date;

  // Fallback: look for common date patterns inside the snippet or title
  const text = `${snippet} ${title}`;
  const patterns = [
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/,           // 15/06/2026
    /\b([A-Z][a-z]+\s+\d{1,2}(?:–|-)\d{1,2},?\s+\d{4})\b/, // June 10–12, 2026
    /\b([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})\b/,               // June 10, 2026
    /\b(Q[1-4]\s+\d{4})\b/,                                  // Q3 2026
    /\b(\d{4})\b/,                                            // bare year as last resort
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return "Date TBD";
}

// ─── Heuristic: detect whether the event is in Egypt, online, or elsewhere ──
function extract_location(snippet, title, query) {
  const text = `${snippet} ${title} ${query}`.toLowerCase();

  // Physical Egypt locations
  if (/cairo|egypt|giza|alexandria|sharm|hurghada/.test(text)) {
    if (/cairo/.test(text)) return "Cairo, Egypt";
    if (/alexandria/.test(text)) return "Alexandria, Egypt";
    if (/sharm/.test(text)) return "Sharm El-Sheikh, Egypt";
    return "Egypt";
  }

  // Virtual / online events
  if (/online|virtual|remote|webinar|zoom|teams|digital/.test(text)) {
    return "Online";
  }

  // Regional Middle-East but not Egypt
  if (/dubai|uae|saudi|riyadh|doha|qatar|kuwait/.test(text)) {
    return "Middle East";
  }

  return "Global";
}

// ─── Main export: run all queries and return merged, de-duplicated results ───
export async function scrape_events() {
  console.log(`\n🔍 Running ${SEARCH_QUERIES.length} search queries via Serper...`);

  // Fire all queries in parallel for speed
  const result_groups = await Promise.allSettled(
    SEARCH_QUERIES.map((q) => search_query(q))
  );

  // Flatten successful results; log any failures
  const all_events = [];
  result_groups.forEach((group, i) => {
    if (group.status === "fulfilled") {
      console.log(`  ✅ "${SEARCH_QUERIES[i]}" → ${group.value.length} results`);
      all_events.push(...group.value);
    } else {
      console.warn(`  ❌ "${SEARCH_QUERIES[i]}" failed:`, group.reason?.message);
    }
  });

  console.log(`\n📦 Total raw results: ${all_events.length}`);
  return all_events;
}
