console.log('PORT env variable:', process.env.PORT);

// server.js — Lightweight static file server using only Node.js built-ins.
// Serves the dashboard (index.html, style.css) and events.json.
// No npm packages required — run with: node server.js

import http from "http";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

// ─── Request handler ─────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Allow the dashboard to fetch from any origin (needed when opened via file://)
  res.setHeader("Access-Control-Allow-Origin", "*");

  const file_path = resolve_file(req.url);

  // Reject anything that escapes the project directory
  if (!file_path) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(file_path, (err, data) => {
    if (err) {
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
server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n🌐 Event Radar dashboard running at http://localhost:${PORT}`);
  console.log(`   Serving files from: ${__dirname}`);
  console.log(`   Press Ctrl+C to stop.\n`);
});
