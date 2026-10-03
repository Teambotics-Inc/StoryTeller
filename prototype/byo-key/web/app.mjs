// Prototype page logic. Run `node prototype/byo-key/build.mjs` first (creates assets.generated.mjs).
// The SDK is loaded from esm.sh for the prototype only; a real build would vendor it (no third-party scripts).
import { runStory } from "../agent.mjs";

const $ = (id) => document.getElementById(id);
const log = (s) => { const el = $("log"); el.textContent += s + "\n"; el.scrollTop = el.scrollHeight; };
const status = (s, cls = "") => { $("status").textContent = s; $("status").className = cls; };
let abort = null;

function estimate() {
  const cap = Number($("cap").value) || 0;
  $("est").textContent = `Hard cap $${cap.toFixed(2)}. Typical cost is unmeasured; this prototype exists to measure it.`;
}
$("cap").addEventListener("input", estimate); estimate();

$("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  let assets;
  try { ({ assets } = await import("./assets.generated.mjs")); } catch { status("Run `node prototype/byo-key/build.mjs` first (assets.generated.mjs is missing).", "bad"); return; }
  const key = $("key").value.trim();
  // globalThis.__TEST_ANTHROPIC__ lets a test inject a scripted fake client; real use always loads the SDK.
  const Anthropic = globalThis.__TEST_ANTHROPIC__ || (await import("https://esm.sh/@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  $("key").value = ""; // the key lives only in the client object from here on
  $("log").textContent = ""; $("result").style.display = "none";
  $("go").disabled = true; $("stop").disabled = false;
  abort = new AbortController();
  status("Working...");
  const model = $("model").value, cap = Number($("cap").value);
  const input = { subject: $("subject").value.trim(), startUrl: $("url").value.trim() || undefined, accent: $("accent").value.trim() || undefined, mode: $("mode").value || undefined };
  let lastCost = 0;
  const result = await runStory({
    client, assets, input, model, effort: $("effort").value, maxUsd: cap, signal: abort.signal,
    onEvent: (ev) => {
      if (ev.type === "turn") { lastCost = ev.costUsd || 0; status(`Turn ${ev.n}, about $${lastCost.toFixed(2)} so far (search fees not counted)`); }
      else if (ev.type === "search") log(`search: ${ev.query}`);
      else if (ev.type === "fetch") log(`fetch:  ${ev.url}`);
      else if (ev.type === "submit") log(`submit: ${ev.errors} error(s), ${ev.warnings} warning(s)`);
    },
  });
  $("go").disabled = false; $("stop").disabled = true; abort = null;
  show(result);
});
$("stop").addEventListener("click", () => abort && abort.abort());

function show(r) {
  const m = r.metrics;
  status(r.ok ? `Done (${r.stop}).` : `Stopped: ${r.stop}${r.error ? `, ${r.error}` : ""}`, r.ok ? "ok" : "bad");
  $("result").style.display = "block";
  $("summary").textContent = r.summary || "";
  const p = m.provenance;
  const rows = [["cost (est., excl. search fees)", m.costUsd == null ? "unknown" : `$${m.costUsd.toFixed(2)}`], ["time", `${Math.round(m.wallMs / 1000)} s`], ["turns / searches / fetches", `${m.turns} / ${m.searches} / ${m.fetches}`], ["submissions (errors, warnings)", m.submissions.map((s) => `${s.errors},${s.warnings}`).join("  ") || "none"]];
  if (p) rows.push(["sources fetched", `${p.fetched}/${p.sources}`], ["evidence verbatim", `${p.evidenceExact}/${p.evidenceTotal - p.evidenceUnverifiable}`]);
  $("metrics").replaceChildren();
  for (const [k, v] of rows) { const tr = document.createElement("tr"); const a = document.createElement("th"), b = document.createElement("td"); a.textContent = k; b.textContent = v; tr.append(a, b); $("metrics").append(tr); }
  $("warns").replaceChildren();
  for (const w of r.warnings || []) { const li = document.createElement("li"); li.textContent = w; $("warns").append(li); }
  const dl = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  $("dl").style.display = $("dlj").style.display = r.ok ? "" : "none";
  $("dl").onclick = () => dl("index.html", r.html, "text/html");
  $("dlj").onclick = () => dl("story.json", JSON.stringify(r.story, null, 2), "application/json");
  $("prev").style.display = r.ok ? "" : "none";
  if (r.ok) $("prev").srcdoc = r.html;
}
