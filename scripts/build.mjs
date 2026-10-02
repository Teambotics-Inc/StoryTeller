#!/usr/bin/env node
// Usage: node scripts/build.mjs <story-dir> [--out path/to/index.html] [--check]
// Reads <story-dir>/story.json and <story-dir>/theme.json (theme optional), validates, and writes
// a single self-contained HTML file. No dependencies; Node 18+.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateStory, validateTheme } from "./validate.mjs";
import { renderStory } from "./render.mjs";

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

const html = renderStory(story, theme);
const out = outIdx >= 0 ? args[outIdx + 1] : path.join(dir, "index.html");
fs.writeFileSync(out, html);
console.log(`→ ${out} (${(html.length / 1024).toFixed(0)} KB, self-contained)`);
