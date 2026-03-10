"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const CONTENT_DIR = path.join(__dirname, "content");
const INDEX_FILE = path.join(__dirname, "content-index.json");

/**
 * Minimal in-memory rate limiter to protect file-system-backed endpoints.
 * Allows up to RATE_LIMIT_MAX requests per IP per RATE_LIMIT_WINDOW_MS.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const requestLog = new Map();

function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  let record = requestLog.get(ip);

  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  record.count += 1;
  requestLog.set(ip, record);

  if (record.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  return next();
}

/**
 * Scans the content directory and returns a structured list of posts
 * grouped by category. Each category corresponds to a subdirectory.
 * @returns {{ [category: string]: { file: string, title: string, excerpt: string }[] }}
 */
function scanContent() {
  const result = {};

  if (!fs.existsSync(CONTENT_DIR)) {
    return result;
  }

  const categories = fs.readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const category of categories) {
    const categoryPath = path.join(CONTENT_DIR, category);
    const files = fs.readdirSync(categoryPath)
      .filter((f) => f.endsWith(".txt"))
      .sort();

    result[category] = files.map((file) => {
      const filePath = path.join(categoryPath, file);
      const raw = fs.readFileSync(filePath, "utf8");
      const lines = raw.split("\n");
      const title = lines[0].trim() || file.replace(".txt", "");
      const bodyLines = lines.filter((l) => l.trim() !== "").slice(1);
      const body = bodyLines.join(" ").trim();
      const excerpt = body.length > 150 ? body.slice(0, 150).trimEnd() + " …" : body;
      return { file, title, excerpt };
    });
  }

  return result;
}

/**
 * Writes the current content index to content-index.json so the static
 * GitHub Pages version stays in sync with newly added text files.
 */
function updateIndex() {
  const index = scanContent();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2) + "\n", "utf8");
  console.log("content-index.json updated.");
}

// Update the static manifest on every server start
updateIndex();

// Serve only the public-facing files; do NOT expose server.js, package.json, etc.
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/index.html", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/post.html", (req, res) => res.sendFile(path.join(__dirname, "post.html")));
app.use("/static", express.static(path.join(__dirname, "static")));
app.use("/content", express.static(CONTENT_DIR));

/**
 * GET /api/posts
 * Returns the full post index with titles, excerpts, and category grouping.
 * This endpoint re-scans the content directory on every request so
 * newly added text files are picked up without a server restart.
 */
app.get("/api/posts", rateLimiter, (req, res) => {
  const index = scanContent();
  res.json(index);
});

/**
 * GET /api/posts/:category/:file
 * Returns the full text content of a single post file.
 */
app.get("/api/posts/:category/:file", rateLimiter, (req, res) => {
  const { category, file } = req.params;

  // Security: only allow safe path segments (no traversal, standard filenames only)
  const safeSegment = /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$/;
  if (!safeSegment.test(category) || !safeSegment.test(file)) {
    return res.status(400).json({ error: "Invalid path" });
  }

  if (!file.endsWith(".txt")) {
    return res.status(400).json({ error: "Only .txt files are supported" });
  }

  const filePath = path.join(CONTENT_DIR, category, file);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Post not found" });
  }

  const content = fs.readFileSync(filePath, "utf8");
  res.type("text/plain; charset=utf-8").send(content);
});

app.listen(PORT, () => {
  console.log(`Project Blog running at http://localhost:${PORT}`);
  console.log(`Posts available via http://localhost:${PORT}/api/posts`);
});
