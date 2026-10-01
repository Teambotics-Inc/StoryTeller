#!/usr/bin/env node
// Usage: node scripts/build-site.mjs
// Builds the product page into site/dist: the page, optimised images, and every example as a live page.
// Environment (all optional):
//   SITE_URL   public origin, e.g. https://example.com  -> adds canonical/og:url, absolute og:image, sitemap.xml
//   REPO_URL   repository URL shown on the page         -> default: package.json "repository"
// Zero dependencies, Node 18+. Example statistics are read from each example's story.json so they cannot drift.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site"), dist = path.join(site, "dist");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const normRepo = (r) => {
  const v = typeof r === "string" ? r : r && r.url;
  if (!v) return null;
  const m = /^github:(.+)$/.exec(v);
  return (m ? `https://github.com/${m[1]}` : v).replace(/^git\+/, "").replace(/\.git$/, "");
};
const repo = (process.env.REPO_URL || normRepo(pkg.repository) || "").replace(/\/$/, "");
if (!/^https:\/\//.test(repo)) { console.error("x no repository URL: set REPO_URL or package.json \"repository\""); process.exit(1); }
const siteUrl = (process.env.SITE_URL || "").replace(/\/$/, "");
if (siteUrl && !/^https:\/\//.test(siteUrl)) { console.error("x SITE_URL must start with https://"); process.exit(1); }

// Clear the folder's contents rather than the folder itself: on Windows a running preview server can hold the folder open.
fs.mkdirSync(dist, { recursive: true });
for (const entry of fs.readdirSync(dist)) fs.rmSync(path.join(dist, entry), { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "assets"), { recursive: true });
for (const f of fs.readdirSync(path.join(site, "assets"))) fs.copyFileSync(path.join(site, "assets", f), path.join(dist, "assets", f));

// examples: copy each built page, and describe it
const exDir = path.join(root, "examples");
const cards = [];
const slugs = [];
const order = ["great-fire-of-london", "salary", "rosetta-stone"];
const found = fs.readdirSync(exDir).filter((d) => fs.existsSync(path.join(exDir, d, "story.json")) && fs.existsSync(path.join(exDir, d, "index.html")));
found.sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)) || a.localeCompare(b));
const thumbs = { "great-fire-of-london": "graph.webp", salary: "ex-salary.webp", "rosetta-stone": "ex-rosetta.webp" };
for (const slug of found) {
  const story = JSON.parse(fs.readFileSync(path.join(exDir, slug, "story.json"), "utf8"));
  const theme = JSON.parse(fs.readFileSync(path.join(exDir, slug, "theme.json"), "utf8"));
  fs.mkdirSync(path.join(dist, "examples", slug), { recursive: true });
  fs.copyFileSync(path.join(exDir, slug, "index.html"), path.join(dist, "examples", slug, "index.html"));
  slugs.push(slug);
  const thumb = thumbs[slug] && fs.existsSync(path.join(site, "assets", thumbs[slug])) ? thumbs[slug] : null;
  const dated = story.nodes.filter((n) => n.start).length;
  const stats = `${story.nodes.length} nodes · ${story.edges.length} edges · ${story.sources.length} sources${dated >= 5 ? " · timeline" : ""} · ${theme.mode} theme`;
  const view = story.defaultView && story.defaultView !== "graph" ? `#view=${story.defaultView}` : "";
  cards.push(`      <a class="card" href="examples/${esc(slug)}/${view}">
        ${thumb ? `<img src="assets/${thumb}" width="1280" height="667" loading="lazy" alt="Preview of the ${esc(story.title)} story">` : ""}
        <div class="meta"><h3>${esc(story.title)}</h3><p>${esc(story.tagline)}</p><span class="stats">${esc(stats)}</span></div>
      </a>`);
}
if (!cards.length) { console.error("x no built examples found in examples/"); process.exit(1); }

let html = fs.readFileSync(path.join(site, "index.template.html"), "utf8");
const fill = {
  CANONICAL: siteUrl ? `<link rel="canonical" href="${esc(siteUrl)}/">\n<meta property="og:url" content="${esc(siteUrl)}/">` : "",
  OG_IMAGE: esc(siteUrl ? `${siteUrl}/assets/og.png` : "assets/og.png"),
  REPO_URL: esc(repo),
  EXAMPLE_CARDS: cards.join("\n"),
};
for (const [k, v] of Object.entries(fill)) html = html.split(`{{${k}}}`).join(v);
if (/\{\{[A-Z_]+\}\}/.test(html)) { console.error("x unfilled placeholder in page"); process.exit(1); }
fs.writeFileSync(path.join(dist, "index.html"), html);

// small extras
fs.writeFileSync(path.join(dist, "404.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found</title><style>body{font:18px/1.6 system-ui,sans-serif;background:#0c0d10;color:#eceae4;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}a{color:#7cc4ff}</style><div><h1>That page isn't here.</h1><p><a href="/">Back to StoryTeller</a></p></div></html>\n`);
fs.writeFileSync(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ""}`);
if (siteUrl) {
  const urls = ["", ...slugs.map((s) => `examples/${s}/`)];
  fs.writeFileSync(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(siteUrl)}/${esc(u)}</loc></url>`).join("\n")}\n</urlset>\n`);
}
const kb = (p) => Math.round(fs.statSync(p).size / 1024);
console.log(`ok site built: ${path.relative(root, dist)} (${slugs.length} examples, index ${kb(path.join(dist, "index.html"))} KB)${siteUrl ? ", canonical " + siteUrl : ""}`);
