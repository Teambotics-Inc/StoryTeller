#!/usr/bin/env node
// Runs the agent loop headless against the real API, for measuring cost, time and quality.
//   node run.mjs "Subject" [--url URL] [--max-usd 5] [--model claude-opus-5-5] [--effort high] [--no-fallbacks] [--dry-run] [--yes]
// Reads the key from ANTHROPIC_API_KEY (or an `ant auth login` profile). Spends real money, so it only calls the API with --yes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAssets } from "./assets.mjs";
import { runStory, buildRequest } from "./agent.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const subject = args.find((a, i) => !a.startsWith("--") && !["--url", "--max-usd", "--model", "--effort", "--out"].includes(args[i - 1]));
if (!subject) { console.error('usage: node run.mjs "Subject" [--url URL] [--max-usd 5] [--model M] [--effort high] [--no-fallbacks] [--dry-run] [--yes]'); process.exit(2); }

export async function runOne({ subject, startUrl, maxUsd, model, effort, fallbacks, outDir, onEvent }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const result = await runStory({ client, assets: loadAssets(), input: { subject, startUrl }, model, effort, maxUsd, fallbacks, onEvent });
  fs.mkdirSync(outDir, { recursive: true });
  const w = (n, d) => fs.writeFileSync(path.join(outDir, n), typeof d === "string" ? d : JSON.stringify(d, null, 2) + "\n");
  w("metrics.json", { subject, ok: result.ok, stop: result.stop, error: result.error, metrics: result.metrics, warnings: result.warnings, summary: result.summary });
  if (result.ok) { w("story.json", result.story); w("theme.json", result.theme); w("index.html", result.html); }
  return result;
}

const opts = { subject, startUrl: val("--url"), maxUsd: Number(val("--max-usd", 5)), model: val("--model", "claude-opus-5-5"), effort: val("--effort", "high"), fallbacks: !flag("--no-fallbacks") };
if (flag("--dry-run")) {
  const req = buildRequest({ assets: loadAssets(), input: { subject, startUrl: opts.startUrl }, model: opts.model, effort: opts.effort, fallbacks: opts.fallbacks, today: new Date().toISOString().slice(0, 10) });
  console.log(JSON.stringify({ ...req, system: `[${req.system.length} chars]` }, null, 2));
  process.exit(0);
}
if (!flag("--yes")) { console.log(`Would run "${subject}" on ${opts.model} (effort ${opts.effort}) with a hard cap of $${opts.maxUsd}. This spends real money on your API key. Re-run with --yes to proceed.`); process.exit(0); }
const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const outDir = val("--out", path.join(here, "runs", `${slug}-${Date.now()}`));
const r = await runOne({ ...opts, outDir, onEvent: (e) => { if (["turn", "search", "fetch", "submit"].includes(e.type)) console.log(JSON.stringify(e)); } });
console.log(`\n${r.ok ? "OK" : "FAILED"} (${r.stop}${r.error ? `: ${r.error}` : ""})  cost ~$${(r.metrics.costUsd ?? 0).toFixed(2)} (excludes search fees)  ${Math.round(r.metrics.wallMs / 1000)}s  turns ${r.metrics.turns}  searches ${r.metrics.searches}  fetches ${r.metrics.fetches}`);
console.log(`results in ${outDir}`);
process.exit(r.ok ? 0 : 1);
