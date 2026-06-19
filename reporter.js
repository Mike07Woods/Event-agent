// reporter.js — Formats ranked event data into a human-readable digest.
// Produces both the full WhatsApp message string and a summary object
// that other modules (notifier, dashboard) can consume.

import config from "./config.js";

// ─── Format a single event line for the WhatsApp message ────────────────────
function format_event_line(event) {
  const location = event.location || "Location TBD";
  const date     = event.date     || "Date TBD";
  return `• ${event.name} — ${date} — ${location}`;
}

// ─── Build the full WhatsApp message text ────────────────────────────────────
function build_whatsapp_message(ranked) {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
  });

  const high_lines   = ranked.high.map(format_event_line).join("\n");
  const medium_lines = ranked.medium.map(format_event_line).join("\n");
  const low_lines    = ranked.low.map(format_event_line).join("\n");

  // Sections are omitted entirely if the bucket is empty
  const sections = [];

  if (ranked.high.length > 0) {
    sections.push(
      `🔴 HIGH PRIORITY (${ranked.high.length} event${ranked.high.length > 1 ? "s" : ""})\n${high_lines}`
    );
  }

  if (ranked.medium.length > 0) {
    sections.push(
      `🟡 MEDIUM PRIORITY (${ranked.medium.length} event${ranked.medium.length > 1 ? "s" : ""})\n${medium_lines}`
    );
  }

  if (ranked.low.length > 0) {
    sections.push(
      `🟢 LOW PRIORITY (${ranked.low.length} event${ranked.low.length > 1 ? "s" : ""})\n${low_lines}`
    );
  }

  const body = sections.length > 0
    ? sections.join("\n\n")
    : "No events found this week. Try again next Monday.";

  return (
    `🎯 Event Radar — Weekly Report\n` +
    `${today}\n\n` +
    body +
    `\n\n📋 Full details: ${config.dashboardUrl}`
  );
}

// ─── Build the next Monday date string shown in the dashboard footer ─────────
function next_monday_label() {
  const today = new Date();
  const day   = today.getDay(); // 0=Sun, 1=Mon, …
  const days_until_monday = day === 1 ? 7 : (8 - day) % 7;
  const next = new Date(today);
  next.setDate(today.getDate() + days_until_monday);
  return next.toLocaleDateString("en-GB", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
  });
}

// ─── Main export: generate the full report object ────────────────────────────
export function build_report(ranked) {
  const whatsapp_message = build_whatsapp_message(ranked);

  // Summary counts shown in the dashboard header bar
  const summary = {
    total:         ranked.total,
    high_count:    ranked.high.length,
    medium_count:  ranked.medium.length,
    low_count:     ranked.low.length,
    scanned_at:    ranked.scanned_at,
    next_scan:     next_monday_label(),
  };

  console.log("\n📝 Report built:");
  console.log(`   Total events : ${summary.total}`);
  console.log(`   High         : ${summary.high_count}`);
  console.log(`   Medium       : ${summary.medium_count}`);
  console.log(`   Low          : ${summary.low_count}`);
  console.log(`   Next scan    : ${summary.next_scan}`);

  return {
    events:  ranked.all,      // flat sorted array written to events.json
    summary,
    whatsapp_message,
  };
}
