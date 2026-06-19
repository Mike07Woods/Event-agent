// ranker.js — Sorts analyzed events by score, removes near-duplicates,
// and groups them into High / Medium / Low priority buckets.

// ─── Fuzzy duplicate detection ───────────────────────────────────────────────
// Two events are considered duplicates if their names share enough words.
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")  // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
}

function similarity_ratio(a, b) {
  const words_a = new Set(normalize(a).split(" "));
  const words_b = new Set(normalize(b).split(" "));
  const intersection = [...words_a].filter((w) => words_b.has(w)).length;
  const union = new Set([...words_a, ...words_b]).size;
  return union === 0 ? 0 : intersection / union;
}

// Return true if two events are likely the same event
function are_duplicates(event_a, event_b) {
  // Exact URL match is a definitive duplicate
  if (event_a.url && event_b.url && event_a.url === event_b.url) return true;

  // Name similarity above threshold → treat as duplicate
  const ratio = similarity_ratio(event_a.name, event_b.name);
  return ratio >= 0.6;
}

// ─── Remove duplicates — keep the copy with the higher score ─────────────────
function deduplicate(events) {
  const unique = [];

  for (const candidate of events) {
    const existing_index = unique.findIndex((e) => are_duplicates(e, candidate));

    if (existing_index === -1) {
      // No duplicate found — add as new entry
      unique.push(candidate);
    } else if (candidate.score > unique[existing_index].score) {
      // Candidate outscores the existing entry — replace it
      unique[existing_index] = candidate;
    }
    // else: keep existing higher-scored entry
  }

  return unique;
}

// ─── Main export: rank and bucket all events ──────────────────────────────────
export function rank_events(analyzed_events) {
  console.log(`\n📊 Ranking and deduplicating ${analyzed_events.length} events...`);

  // Sort descending by score (ties broken by name for stable ordering)
  const sorted = [...analyzed_events].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  // Remove near-duplicates
  const unique = deduplicate(sorted);

  console.log(`  Removed ${analyzed_events.length - unique.length} duplicates → ${unique.length} unique events`);

  // Group into priority buckets
  const buckets = {
    high:   unique.filter((e) => e.priority === "High"),
    medium: unique.filter((e) => e.priority === "Medium"),
    low:    unique.filter((e) => e.priority === "Low"),
  };

  console.log(`  🔴 High: ${buckets.high.length}  🟡 Medium: ${buckets.medium.length}  🟢 Low: ${buckets.low.length}`);

  return {
    all: unique,
    ...buckets,
    scanned_at: new Date().toISOString(),
    total: unique.length,
  };
}
