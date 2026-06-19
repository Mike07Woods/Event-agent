// config.js — Central configuration loader
// Reads all environment variables from .env and exports them as a single object.
// Every other module should import from here — never read process.env elsewhere.

import dotenv from "dotenv";
dotenv.config();

// ─── Helper: crash early with a clear message if a required var is missing ──
function require_env(name) {
  const value = process.env[name];
  if (!value || value.startsWith("your-")) {
    throw new Error(
      `Missing or placeholder value for environment variable: ${name}\n` +
        `Open .env and replace the placeholder with your real key.`
    );
  }
  return value;
}

// ─── Exported config object ─────────────────────────────────────────────────
const config = {
  // Serper API — used by scraper.js to search the web
  serper: {
    apiKey: require_env("SERPER_API_KEY"),
    endpoint: "https://google.serper.dev/search",
  },

  // Twilio — used by notifier.js to send WhatsApp messages
  twilio: {
    accountSid: require_env("TWILIO_ACCOUNT_SID"),
    authToken: require_env("TWILIO_AUTH_TOKEN"),
    from: require_env("TWILIO_FROM"),       // e.g. whatsapp:+14155238886
    to: require_env("MY_WHATSAPP"),         // e.g. whatsapp:+201234567890
  },

  // Scheduler — cron expression for every Monday at 08:00 Cairo time (UTC+2)
  scheduler: {
    cronExpression: "0 8 * * 1",           // minute hour day month weekday
    timezone: "Africa/Cairo",
  },

  // Output — where the agent writes scan results for the dashboard to read
  output: {
    eventsFile: "./events.json",
  },

  // Dashboard — base URL shown in the WhatsApp digest
  // Change this to your actual deployed URL if you host the dashboard online
  dashboardUrl: "http://localhost:8080/index.html",
};

export default config;
