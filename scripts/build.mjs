#!/usr/bin/env node
// Usage: node scripts/build.mjs <story-dir> [--out path/to/index.html] [--check]
// Reads <story-dir>/story.json and <story-dir>/theme.json (theme optional), validates, and writes
// a single self-contained HTML file. No dependencies; Node 18+.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStory, validateTheme } from "./validate.mjs";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const dir = args.find((a, i) => !a.startsWith("--") && (outIdx < 0 || i !== outIdx + 1));
const check = args.includes("--check");
if (!dir) { console.error("usage: node scripts/build.mjs <story-dir> [--out file] [--check]"); process.exit(2); }

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { console.error(`✗ cannot read ${p}: ${e.message}`); process.exit(1); } };
const story = readJson(path.join(dir, "story.json"));
const themePath = path.join(dir, "theme.json");
const theme = fs.existsSync(themePath) ? readJson(themePath) : readJson(path.join(here, "..", "template", "default-theme.json"));

const a = validateStory(story), b = validateTheme(theme, story);
const errors = [...a.errors.map((m) => `story: ${m}`), ...b.errors.map((m) => `theme: ${m}`)];
const warnings = [...a.warnings.map((m) => `story: ${m}`), ...b.warnings.map((m) => `theme: ${m}`)];
for (const w of warnings) console.warn(`! ${w}`);
for (const e of errors) console.error(`✗ ${e}`);
if (errors.length) { console.error(`\n${errors.length} error(s). Fix and re-run.`); process.exit(1); }
console.log(`✓ valid: ${story.nodes.length} nodes · ${story.edges.length} edges · ${story.sources.length} sources · ${(story.stories || []).length} stories${warnings.length ? ` · ${warnings.length} warning(s)` : ""}`);
if (check) process.exit(0);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// JSON is embedded in a <script type="application/json"> block: neutralise "<" so "</script>" can never appear.
const BS = String.fromCharCode(92); // backslash, spelled out so nothing can "helpfully" unescape it
const uEsc = (ch) => BS + "u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
const json = (o) => [60, 0x2028, 0x2029].reduce((s, cp) => s.split(String.fromCharCode(cp)).join(uEsc(String.fromCharCode(cp))), JSON.stringify(o));
const c = theme.colors;
const rootCss = `:root{--bg:${c.bg};--surface:${c.surface || c.bg};--text:${c.text};--muted:${c.muted || c.text};--line:${c.line || "rgba(128,128,128,.25)"};--accent:${c.accent};color-scheme:${theme.mode}}`;
const fontLinks = theme.font?.googleFonts
  ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(theme.font.googleFonts)}">`
  : "";
const desc = `${story.tagline}${story.disclaimer ? " " + story.disclaimer : ""}`;

let html = fs.readFileSync(path.join(here, "..", "template", "story.html"), "utf8");
const fill = {
  TITLE: esc(`${story.title} · Story Graph`),
  DESCRIPTION: esc(desc),
  THEME_COLOR: esc(c.bg),
  ACCENT_HEX: c.accent.replace("#", ""),
  ROOT_CSS: rootCss,
  FONT_LINKS: fontLinks,
  NOSCRIPT: `<h1>${esc(story.title)}</h1><p>${esc(story.tagline)}</p><p>This interactive story graph needs JavaScript. The full content follows.</p><ul>${story.nodes.map((n) => `<li><strong>${esc(n.title)}</strong>: ${esc(n.summary)}</li>`).join("")}</ul>`,
  THEME_JSON: json(theme),
  STORY_JSON: json(story),
};
for (const [k, v] of Object.entries(fill)) html = html.split(`{{${k}}}`).join(v);
const out = outIdx >= 0 ? args[outIdx + 1] : path.join(dir, "index.html");
fs.writeFileSync(out, html);
console.log(`→ ${out} (${(html.length / 1024).toFixed(0)} KB, self-contained)`);
