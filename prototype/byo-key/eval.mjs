#!/usr/bin/env node
// Runs every subject in subjects.json and writes runs/summary.md. Spends real money: max total = subjects x --max-usd.
//   node eval.mjs [--max-usd 5] [--model M] [--effort E] [--no-fallbacks] [--yes]
// Needs ANTHROPIC_API_KEY. Without --yes it only prints what it would do.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const subjects = JSON.parse(fs.readFileSync(path.join(here, "subjects.json"), "utf8"));
const maxUsd = Number(val("--max-usd", 5)), model = val("--model", "claude-opus-5-5"), effort = val("--effort", "high"), fallbacks = !flag("--no-fallbacks");
console.log(`${subjects.length} subjects, cap $${maxUsd} each (worst case $${(subjects.length * maxUsd).toFixed(2)} before search fees), ${model}, effort ${effort}`);
if (!flag("--yes")) { console.log("Dry run. Re-run with --yes to spend."); process.exit(0); }

// run.mjs exports runOne but also executes on import, so it is invoked as a child process per subject instead.
import { spawnSync } from "node:child_process";
const stamp = Date.now(), rows = [];
for (const s of subjects) {
  const outDir = path.join(here, "runs", `eval-${stamp}`, s.kind);
  const a = [path.join(here, "run.mjs"), s.subject, "--max-usd", String(maxUsd), "--model", model, "--effort", effort, "--yes", "--out", outDir, ...(s.url ? ["--url", s.url] : []), ...(fallbacks ? [] : ["--no-fallbacks"])];
  console.log(`\n== ${s.kind}: ${s.subject}`);
  spawnSync(process.execPath, a, { stdio: "inherit" });
  const f = path.join(outDir, "metrics.json");
  rows.push({ s, m: fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null });
}
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "n/a");
const lines = ["| subject | ok | stop | cost $ | secs | turns | searches | fetches | submits | sources fetched | evidence verbatim |", "|---|---|---|---|---|---|---|---|---|---|---|"];
for (const { s, m } of rows) {
  if (!m) { lines.push(`| ${s.kind} | no result | | | | | | | | | |`); continue; }
  const x = m.metrics, p = x.provenance;
  lines.push(`| ${s.kind} | ${m.ok} | ${m.stop} | ${(x.costUsd ?? 0).toFixed(2)} | ${Math.round(x.wallMs / 1000)} | ${x.turns} | ${x.searches} | ${x.fetches} | ${x.submissions.length} | ${p ? pct(p.fetched, p.sources) : "n/a"} | ${p ? pct(p.evidenceExact, p.evidenceTotal - p.evidenceUnverifiable) : "n/a"} |`);
}
fs.writeFileSync(path.join(here, "runs", `eval-${stamp}`, "summary.md"), lines.join("\n") + "\n");
console.log("\n" + lines.join("\n"));
