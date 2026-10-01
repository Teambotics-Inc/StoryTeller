#!/usr/bin/env node
// Usage: node scripts/build-site.mjs
// Builds the product site into site/dist:
//   /                          landing page (featured stories: picker + embedded viewer with full screen)
//   /stories/<slug>/           a page per story (viewer, about, guided stories, sources, more stories)
//   /stories/<slug>/full/      the story itself as a standalone page (what the viewers embed)
// Stories come from examples/ (committed) plus an optional site/showcase/<slug>/ folder with story.json + theme.json
// (git-ignored, so a deployer can feature extra stories without committing them). A showcase folder may also hold thumb.webp.
// Environment (all optional):
//   SITE_URL      public origin, e.g. https://example.com -> canonical/og:url, absolute og:image, sitemap.xml
//   REPO_URL      repository URL shown on the pages        -> default: package.json "repository"
//   SITE_OUT      output folder                            -> default: site/dist
//   SHOWCASE_DIR  showcase folder                          -> default: site/showcase
// Zero dependencies, Node 18+. Statistics are read from each story's own data, so they cannot drift.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site");
const dist = process.env.SITE_OUT ? path.resolve(process.env.SITE_OUT) : path.join(site, "dist");
const showcaseDir = process.env.SHOWCASE_DIR ? path.resolve(process.env.SHOWCASE_DIR) : path.join(site, "showcase");
const fail = (m) => { console.error("x " + m); process.exit(1); };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BS = String.fromCharCode(92); // backslash, spelled out so nothing can unescape it
const forScript = (o) => [60, 0x2028, 0x2029].reduce((s, cp) => s.split(String.fromCharCode(cp)).join(BS + "u" + cp.toString(16).padStart(4, "0")), JSON.stringify(o));
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const pkg = readJson(path.join(root, "package.json"));
const normRepo = (r) => { const v = typeof r === "string" ? r : r && r.url; if (!v) return null; const m = /^github:(.+)$/.exec(v); return (m ? `https://github.com/${m[1]}` : v).replace(/^git\+/, "").replace(/\.git$/, ""); };
const repo = (process.env.REPO_URL || normRepo(pkg.repository) || "").replace(/\/$/, "");
if (!/^https:\/\//.test(repo)) fail('no repository URL: set REPO_URL or package.json "repository"');
const siteUrl = (process.env.SITE_URL || "").replace(/\/$/, "");
if (siteUrl && !/^https:\/\//.test(siteUrl)) fail("SITE_URL must start with https://");

/* ---------- gather stories ---------- */
const ORDER = ["great-fire-of-london", "salary", "rosetta-stone"]; // preferred order for the committed examples; anything else follows alphabetically
const entries = [];
const add = (slug, dir, kind, thumbSrc) => {
  if (entries.some((e) => e.slug === slug)) fail(`duplicate story slug '${slug}'`);
  entries.push({ slug, dir, kind, story: readJson(path.join(dir, "story.json")), theme: readJson(path.join(dir, "theme.json")), thumbSrc });
};
const exDir = path.join(root, "examples");
for (const d of fs.existsSync(exDir) ? fs.readdirSync(exDir) : []) {
  const dir = path.join(exDir, d);
  if (fs.existsSync(path.join(dir, "story.json")) && fs.existsSync(path.join(dir, "index.html"))) add(d, dir, "example", path.join(site, "assets", `thumb-${d}.webp`));
}
for (const d of fs.existsSync(showcaseDir) ? fs.readdirSync(showcaseDir) : []) {
  const dir = path.join(showcaseDir, d);
  if (fs.existsSync(path.join(dir, "story.json")) && fs.existsSync(path.join(dir, "theme.json"))) add(d, dir, "showcase", path.join(dir, "thumb.webp"));
}
if (!entries.length) fail("no stories found in examples/ or the showcase folder");
// examples first, then showcase stories. A showcase folder may hold order.json (an array of slugs) to choose their order.
let showcaseOrder = [];
try { showcaseOrder = readJson(path.join(showcaseDir, "order.json")); } catch { /* optional */ }
const pos = (list, slug) => (list.indexOf(slug) < 0 ? 999 : list.indexOf(slug));
entries.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "example" ? -1 : 1)
  || (a.kind === "example" ? pos(ORDER, a.slug) - pos(ORDER, b.slug) : pos(showcaseOrder, a.slug) - pos(showcaseOrder, b.slug))
  || a.slug.localeCompare(b.slug));

const VIEWS = ["graph", "timeline", "read", "outline", "list"];
for (const e of entries) {
  const s = e.story, dated = s.nodes.filter((n) => n.start).length;
  const can = { graph: true, timeline: dated >= 5, read: (s.stories || []).length > 0, outline: true, list: true };
  let views = (Array.isArray(s.views) && s.views.length ? s.views : VIEWS).filter((v) => can[v]);
  if (!views.length) views = ["graph"];
  e.views = views;
  e.def = views.includes(s.defaultView) ? s.defaultView : views.includes("graph") ? "graph" : views[0];
  e.stats = `${s.nodes.length} nodes · ${s.edges.length} edges · ${s.sources.length} sources`;
  e.chips = [`${s.nodes.length} nodes`, `${s.edges.length} edges`, `${s.sources.length} sources`, `${(s.stories || []).length} guided stories`, ...(can.timeline ? ["timeline"] : []), `${e.theme.mode} theme`];
  e.note = [s.disclaimer, s.credit].filter(Boolean).join(" ");
  e.page = `/stories/${e.slug}/`;
  e.full = `/stories/${e.slug}/full/`;
  e.thumb = fs.existsSync(e.thumbSrc) ? `/assets/thumb-${e.slug}.webp` : null;
}

/* ---------- output folder ---------- */
// Clear the folder's contents rather than the folder itself: on Windows a running preview server can hold the folder open.
fs.mkdirSync(dist, { recursive: true });
for (const entry of fs.readdirSync(dist)) fs.rmSync(path.join(dist, entry), { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "assets"), { recursive: true });
for (const f of fs.readdirSync(path.join(site, "assets"))) fs.copyFileSync(path.join(site, "assets", f), path.join(dist, "assets", f));
for (const e of entries) if (e.thumb) fs.copyFileSync(e.thumbSrc, path.join(dist, "assets", `thumb-${e.slug}.webp`));

/* ---------- full pages ---------- */
for (const e of entries) {
  const out = path.join(dist, "stories", e.slug, "full");
  fs.mkdirSync(out, { recursive: true });
  if (e.kind === "example") fs.copyFileSync(path.join(e.dir, "index.html"), path.join(out, "index.html"));
  else {
    try { execFileSync("node", [path.join(root, "scripts", "build.mjs"), e.dir, "--out", path.join(out, "index.html")], { stdio: "pipe" }); }
    catch (err) { fail(`showcase story '${e.slug}' failed to build:\n${(err.stdout || "") + (err.stderr || "")}`); }
  }
}

/* ---------- shared fragments ---------- */
const card = (e, current) =>
  `      <a class="pick" href="${e.page}" data-slug="${esc(e.slug)}"${current ? ' aria-current="true"' : ""}>${e.thumb ? `<img src="${e.thumb}" width="1280" height="667" loading="lazy" alt="">` : '<div class="ph"></div>'}<span>${esc(e.story.title)}<small>${esc(e.stats)}</small></span></a>`;
const payload = (list) => forScript(list.map((e) => ({ slug: e.slug, title: e.story.title, tagline: e.story.tagline, stats: e.stats, note: e.note, views: e.views, def: e.def, page: e.page, full: e.full })));
const canonical = (p) => (siteUrl ? `<link rel="canonical" href="${esc(siteUrl + p)}">\n<meta property="og:url" content="${esc(siteUrl + p)}">` : "");
const ogImage = esc(siteUrl ? `${siteUrl}/assets/og.png` : "/assets/og.png");
const fillAll = (html, map) => {
  for (const [k, v] of Object.entries(map)) html = html.split(`{{${k}}}`).join(v);
  const left = /\{\{[A-Z_]+\}\}/.exec(html);
  if (left) fail(`unfilled placeholder ${left[0]}`);
  return html;
};
const frameSrc = (e) => `${e.full}#view=${e.def}`;

/* ---------- landing page ---------- */
{
  const first = entries[0];
  const html = fillAll(fs.readFileSync(path.join(site, "index.template.html"), "utf8"), {
    CANONICAL: canonical("/"), OG_IMAGE: ogImage, REPO_URL: esc(repo),
    PICKER: entries.map((e, i) => card(e, i === 0)).join("\n"),
    V_TITLE: esc(first.story.title), V_TAGLINE: esc(first.story.tagline), V_STATS: esc(first.stats), V_NOTE: esc(first.note),
    V_PAGE: first.page, V_FULL: esc(frameSrc(first)), V_FRAME: esc(frameSrc(first)),
    SHOWCASE_JSON: payload(entries),
  });
  fs.writeFileSync(path.join(dist, "index.html"), html);
}

/* ---------- a page per story ---------- */
const storyTpl = fs.readFileSync(path.join(site, "story.template.html"), "utf8");
for (const e of entries) {
  const s = e.story, others = entries.filter((o) => o !== e);
  const srcItems = s.sources.map((x) => {
    const ok = /^https?:\/\//.test(x.url);
    return `          <li>${ok ? `<a href="${esc(x.url)}" rel="noopener">${esc(x.title)}</a>` : esc(x.title)}${x.accessed ? `<small>Accessed ${esc(x.accessed)}</small>` : ""}</li>`;
  }).join("\n");
  const guided = (s.stories || []).length
    ? `<h2 style="font-size:22px;margin:0 0 12px">Guided stories</h2>\n        <ul class="gstories">\n${s.stories.map((g) => `          <li><b>${esc(g.title)}</b>${g.summary ? `<span>${esc(g.summary)}</span>` : ""}<button class="btn small" type="button" data-story-id="${esc(g.id)}">Play in the viewer</button></li>`).join("\n")}\n        </ul>`
    : "";
  const about = [s.credit, s.generated && s.generated.date ? `Built ${s.generated.date}.` : ""].filter(Boolean).join(" ");
  const html = fillAll(storyTpl, {
    CANONICAL: canonical(e.page), OG_IMAGE: ogImage, REPO_URL: esc(repo),
    TITLE: esc(s.title), DESCRIPTION: esc(s.tagline), TAGLINE: esc(s.tagline),
    CHIPS: e.chips.map((c) => `<span>${esc(c)}</span>`).join(""),
    STATS: esc(e.stats), V_PAGE: e.page, V_FULL: esc(frameSrc(e)), V_FRAME: esc(frameSrc(e)), V_NOTE: esc(e.note),
    ABOUT: esc(about), SOURCE_COUNT: String(s.sources.length), SOURCES: srcItems, GUIDED: guided,
    MORE: others.map((o) => card(o, false)).join("\n"),
    SHOWCASE_JSON: payload([e]),
  });
  fs.writeFileSync(path.join(dist, "stories", e.slug, "index.html"), html);
}

/* ---------- extras ---------- */
fs.writeFileSync(path.join(dist, "404.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found</title><style>body{font:18px/1.6 system-ui,sans-serif;background:#0c0d10;color:#eceae4;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}a{color:#7cc4ff}</style><div><h1>That page isn't here.</h1><p><a href="/">Back to StoryTeller</a></p></div></html>\n`);
fs.writeFileSync(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ""}`);
if (siteUrl) {
  const urls = ["/", ...entries.flatMap((e) => [e.page, e.full])];
  fs.writeFileSync(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(siteUrl + u)}</loc></url>`).join("\n")}\n</urlset>\n`);
}
const missing = entries.filter((e) => !e.thumb).map((e) => e.slug);
if (missing.length) console.warn(`! no thumbnail for: ${missing.join(", ")} (cards show a plain block)`);
console.log(`ok site built: ${path.relative(root, dist) || dist} (${entries.length} stories: ${entries.map((e) => e.slug + (e.kind === "showcase" ? "*" : "")).join(", ")}${siteUrl ? "; canonical " + siteUrl : ""})`);
