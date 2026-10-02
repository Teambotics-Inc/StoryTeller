#!/usr/bin/env node
// Usage: node scripts/publish.mjs <story-dir> [--to <service-url>] [--yes] [--update | --delete]
// Publishes a story to a public page on a service that speaks the protocol in docs/publishing.md. No account needed:
// the service returns a secret edit token, which is saved next to the story in <story-dir>/.publish.json.
// Safe by default: without --yes it validates and prints what WOULD be sent, then stops. Publishing is public, so an agent
// must only pass --yes after the user has said they want that story published.
// No dependencies; Node 18+.
import fs from "node:fs";
import path from "node:path";
import { validateStory, validateTheme } from "./validate.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const dir = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--to");
const fail = (m, code = 1) => { console.error(`✗ ${m}`); process.exit(code); };
if (!dir) fail("usage: node scripts/publish.mjs <story-dir> [--to <service-url>] [--yes] [--update | --delete]", 2);
if (flag("--update") && flag("--delete")) fail("choose one of --update or --delete", 2);

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return fail(`cannot read ${p}: ${e.message}`); } };
const story = readJson(path.join(dir, "story.json"));
const theme = readJson(path.join(dir, "theme.json"));
const receiptPath = path.join(dir, ".publish.json");
const receipt = fs.existsSync(receiptPath) ? readJson(receiptPath) : null;

const to = (val("--to") || process.env.STORYTELLER_PUBLISH_URL || "").replace(/\/$/, "");
if (!to) fail("no publishing service configured. Pass --to <url> or set STORYTELLER_PUBLISH_URL. (Or skip publishing: index.html is one file you can put on any static host.)", 2);
if (!/^https:\/\//.test(to) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(to)) fail("the service URL must be https:// (http is allowed only for localhost)", 2);

const a = validateStory(story), b = validateTheme(theme, story);
const errors = [...a.errors.map((m) => `story: ${m}`), ...b.errors.map((m) => `theme: ${m}`)];
for (const w of [...a.warnings, ...b.warnings]) console.warn(`! ${w}`);
if (errors.length) { for (const e of errors) console.error(`✗ ${e}`); fail(`${errors.length} validation error(s); fix them before publishing`); }

// Local gates that mirror the service policy, so the user hears about a refusal before anything is sent.
if (story.subject?.kind === "relationship") fail("stories about private relationships are not published publicly");
if (!story.credit || !story.disclaimer) fail("credit and disclaimer are required to publish");

const body = JSON.stringify({ story, theme });
const mode = flag("--delete") ? "delete" : flag("--update") ? "update" : "create";
if (mode !== "create" && !receipt) fail(`no ${receiptPath}: this story has not been published from this folder`);
if (mode === "create" && receipt && !flag("--force-new")) fail(`already published at ${receipt.url}. Use --update to change it, or --force-new for a second page`);

console.log(`${mode === "create" ? "Would publish" : mode === "update" ? "Would update" : "Would delete"}: "${story.title}" (${story.nodes.length} nodes, ${(Buffer.byteLength(body) / 1024).toFixed(0)} KB) to ${to}`);
if (mode === "create") console.log("The page will be public to anyone with the link, and not indexed by search engines.");
if (!flag("--yes")) { console.log("Dry run. Re-run with --yes once the user has agreed to publish."); process.exit(0); }

const headers = { "content-type": "application/json", ...(receipt && mode !== "create" ? { authorization: `Bearer ${receipt.editToken}` } : {}) };
const method = { create: "POST", update: "PUT", delete: "DELETE" }[mode];
const endpoint = mode === "create" ? `${to}/v1/stories` : `${to}/v1/stories/${receipt.id}`;
let res;
try { res = await fetch(endpoint, { method, headers, body: mode === "delete" ? undefined : body }); } catch (e) { fail(`could not reach ${to}: ${e.message}`); }
const out = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`✗ service said ${res.status}: ${out.error || "unknown error"}`); for (const d of out.details || []) console.error(`  - ${d}`); process.exit(1); }

if (mode === "delete") { fs.rmSync(receiptPath, { force: true }); console.log(`✓ deleted ${receipt.url}`); process.exit(0); }
if (mode === "create") fs.writeFileSync(receiptPath, JSON.stringify({ id: out.id, url: out.url, editToken: out.editToken, service: to, publishedAt: new Date().toISOString() }, null, 2) + "\n", { mode: 0o600 });
console.log(`✓ ${mode === "create" ? "published" : "updated"}: ${out.url}`);
if (mode === "create") console.log(`  Edit token saved to ${receiptPath} (keep it private; do not commit it).`);
