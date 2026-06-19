console.log('PORT env variable:', process.env.PORT);

// server.js — Lightweight static file server using only Node.js built-ins.
// Serves the dashboard (index.html, style.css) and events.json.
// No npm packages required — run with: node server.js

import http from "http";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { scrape_events }  from "./scraper.js";
import { analyze_events } from "./analyzer.js";
import { rank_events }    from "./ranker.js";
import { build_report }   from "./reporter.js";
import { send_whatsapp }  from "./notifier.js";

const PORT = process.env.PORT || 8080;

// Resolve the directory this file lives in (ESM has no __dirname by default)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── MIME types for every file the dashboard needs ───────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico":  "image/x-icon",
};

// ─── Map a request URL to a file path on disk ────────────────────────────────
function resolve_file(url_path) {
  // Strip query string (e.g. ?t=1234 cache-busters from the dashboard)
  const clean = url_path.split("?")[0];

  // Serve index.html for the root path
  const rel = clean === "/" ? "/index.html" : clean;

  // Prevent directory traversal: keep the path inside __dirname
  const abs = path.normalize(path.join(__dirname, rel));
  if (!abs.startsWith(__dirname)) return null;

  return abs;
}

// ─── Pipeline runner (shared with /run-scan endpoint) ────────────────────────
let scan_running = false;

async function run_pipeline() {
  const raw      = await scrape_events();
  const analyzed = analyze_events(raw);
  const ranked   = rank_events(analyzed);
  const report   = build_report(ranked);

  await fs.promises.writeFile(
    path.join(__dirname, "events.json"),
    JSON.stringify({ summary: report.summary, events: report.events }, null, 2),
    "utf-8"
  );

  await send_whatsapp(report.whatsapp_message);
  return report.summary;
}

// ─── Request handler ─────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Allow the dashboard to fetch from any origin (needed when opened via file://)
  res.setHeader("Access-Control-Allow-Origin", "*");

  // POST /run-scan — trigger the full pipeline over HTTP
  if (req.method === "POST" && req.url.split("?")[0] === "/run-scan") {
    if (scan_running) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Scan already in progress" }));
      return;
    }

    scan_running = true;
    console.log("\n🔁 /run-scan triggered via HTTP POST");

    run_pipeline()
      .then((summary) => {
        console.log("✅ /run-scan complete:", summary);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, summary }));
      })
      .catch((err) => {
        console.error("❌ /run-scan failed:", err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      })
      .finally(() => {
        scan_running = false;
      });

    return;
  }

  const file_path = resolve_file(req.url);

  // Reject anything that escapes the project directory
  if (!file_path) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(file_path, (err, data) => {
    if (err) {
      // events.json not yet written (no scan has run) — return a safe empty state
      if (err.code === "ENOENT" && file_path.endsWith("events.json")) {
        const empty = JSON.stringify({
          events: [],
          lastScan: null,
          nextScan: null,
          summary: { total: 0, high: 0, medium: 0, low: 0 },
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(empty);
        return;
      }

      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end(`Not found: ${req.url}`);
      } else {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Server error");
      }
      return;
    }

    const ext  = path.extname(file_path).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

// ─── Start listening ─────────────────────────────────────────────────────────
try {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🌐 Event Radar dashboard running at http://localhost:${PORT}`);
    console.log(`   Serving files from: ${__dirname}`);
    console.log(`   Press Ctrl+C to stop.\n`);
  });
} catch (err) {
  console.error("Failed to start server:", err.message);
  process.exit(1);
}
