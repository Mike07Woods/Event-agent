# Event Radar — Agent Documentation

## What this project does
A Node.js agent that runs every Monday at 08:00 Cairo time, searches the web for
upcoming SaaS / BPO / call center / hiring / networking events (Egypt + global online),
scores and ranks them, writes `events.json` for the dashboard, and sends a WhatsApp
digest via Twilio.

## File map
| File | Role |
|------|------|
| `config.js` | Reads `.env`; single source of truth for all settings |
| `scraper.js` | Fires 8 Serper API queries in parallel; returns raw event objects |
| `analyzer.js` | Scores each event 1–10; generates priority label + capitalize note |
| `ranker.js` | Sorts, deduplicates, buckets into High / Medium / Low |
| `reporter.js` | Builds WhatsApp message text + summary object |
| `notifier.js` | Sends WhatsApp via Twilio SDK |
| `scheduler.js` | Cron daemon (node-cron) + manual `--now` flag; orchestrates pipeline |
| `index.html` | Static dashboard; reads `events.json` at runtime |
| `style.css` | Dark-theme styles; no build step needed |
| `events.json` | Written by agent after each scan; read by dashboard (gitignored) |

## Environment variables (set in .env)
- `SERPER_API_KEY` — from serper.dev
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` — from console.twilio.com
- `TWILIO_FROM` — Twilio WhatsApp sandbox number (format: `whatsapp:+14155238886`)
- `MY_WHATSAPP` — your WhatsApp number (format: `whatsapp:+201234567890`)

## Run commands
```bash
# Install dependencies (once)
npm install

# Start the scheduler daemon (waits for Monday 08:00)
node scheduler.js

# Trigger an immediate scan (for testing)
node scheduler.js --now

# Serve the dashboard locally
npx serve . -p 8080
```

## Dependencies
- `dotenv` — load .env
- `node-fetch` — HTTP requests to Serper
- `node-cron` — weekly schedule
- `twilio` — WhatsApp notifications

## Adding a new search query
Open `scraper.js` and add a string to the `SEARCH_QUERIES` array. No other changes needed.

## Changing the schedule
Edit `config.js` → `scheduler.cronExpression`. Standard cron syntax.
Current: `"0 8 * * 1"` = Monday at 08:00.

## Notes
- `events.json` is the handshake between the Node agent and the browser dashboard.
- The dashboard auto-refreshes every 5 minutes.
- The "Run Scan Now" button requires a `/api/scan` HTTP endpoint — add Express if needed.
- Never commit `.env` to git.
