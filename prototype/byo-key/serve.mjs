#!/usr/bin/env node
// Static dev server for the prototype page. Serves the repository root so the page can import /scripts/validate.mjs.
// usage: node prototype/byo-key/serve.mjs [port]   then open http://localhost:<port>/prototype/byo-key/web/
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const port = Number(process.argv[2] || 8788);
const types = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css" };

http.createServer((req, res) => {
  const p = path.normalize(path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!p.startsWith(root) || p.includes(`${path.sep}.git${path.sep}`)) { res.writeHead(403).end(); return; }
  const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, "index.html") : p;
  if (!fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`http://localhost:${port}/prototype/byo-key/web/`));
