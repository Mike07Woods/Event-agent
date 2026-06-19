// notifier.js — Sends the weekly WhatsApp digest via the Twilio API.
// Uses the official Twilio Node.js helper library.

import twilio from "twilio";
import config  from "./config.js";

// ─── Initialize Twilio client once (reused across calls) ─────────────────────
let client;
function get_client() {
  if (!client) {
    client = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return client;
}

// ─── Condense the full digest to fit Twilio's 1600-character limit ───────────
// Strategy: keep only High priority events (max 5), then append a summary
// line for Medium events so the recipient knows what else exists.
function condense_message(full_message) {
  const lines = full_message.split("\n");

  const header_lines  = [];  // title + date
  const high_events   = [];  // bullet lines from the High section
  let medium_count    = 0;
  let footer_line     = "";
  let current_section = null;
  let header_done     = false;

  for (const line of lines) {
    if (line.startsWith("🔴")) { current_section = "high";   header_done = true; continue; }
    if (line.startsWith("🟡")) { current_section = "medium"; continue; }
    if (line.startsWith("🟢")) { current_section = "low";    continue; }
    if (line.startsWith("📋")) { footer_line = line;         continue; }

    if (!header_done) {
      header_lines.push(line);
    } else if (line.startsWith("•")) {
      if (current_section === "high")   high_events.push(line);
      if (current_section === "medium") medium_count++;
    }
  }

  const top_high = high_events.slice(0, 5);
  const hidden   = high_events.length - top_high.length;  // High events cut off

  const parts = [
    ...header_lines,
    "",
    `🔴 HIGH PRIORITY (${top_high.length} event${top_high.length !== 1 ? "s" : ""})`,
    ...top_high,
  ];

  // Mention any High events that were cut to stay within the limit
  if (hidden > 0) {
    parts.push(`+ ${hidden} more high priority event${hidden !== 1 ? "s" : ""}`);
  }

  // Always show Medium count so the recipient knows what to check on the dashboard
  if (medium_count > 0) {
    parts.push(`+ ${medium_count} medium priority event${medium_count !== 1 ? "s" : ""}`);
  }

  if (footer_line) {
    parts.push("", footer_line);
  }

  return parts.join("\n");
}

// ─── Send a single WhatsApp message ──────────────────────────────────────────
export async function send_whatsapp(message_text) {
  console.log("\n📱 Sending WhatsApp notification...");
  console.log(`   From : ${config.twilio.from}`);
  console.log(`   To   : ${config.twilio.to}`);

  // Rebuild the message so it contains only High priority events (max 5)
  // with a summary line for Medium events — keeps us well under 1600 chars.
  const body = condense_message(message_text);

  try {
    const msg = await get_client().messages.create({
      from: config.twilio.from,
      to:   config.twilio.to,
      body,
    });

    console.log(`   ✅ Message sent. SID: ${msg.sid}`);
    return { success: true, sid: msg.sid };
  } catch (err) {
    // Log the error but don't crash the whole pipeline — the scan data is
    // already written to events.json even if the notification fails.
    console.error(`   ❌ WhatsApp send failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}
