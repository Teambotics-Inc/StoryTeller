// Browser-safe agent loop for the bring-your-own-key generator prototype (issue #13, docs/byo-key-generator.md).
// It takes an injected `client` (the official Anthropic SDK, or a fake in tests) and uses no Node APIs.
// Design points:
//  - The conversation is append-only (earlier messages are never edited or pruned), which keeps thinking blocks valid.
//  - Research uses Anthropic's server-side web_search / web_fetch tools; the page only sees their results.
//  - submit_story is a client tool: the page validates the draft, checks provenance against what the tools returned,
//    and feeds errors back until the draft passes or a cap is hit.
import { validateStory, validateTheme } from "../../scripts/validate.mjs";
import { renderWithTemplate } from "../../scripts/render-core.mjs";
import { createLedger, checkProvenance } from "./provenance.mjs";
import { buildSystemPrompt, buildUserMessage } from "./prompt.mjs";

// USD per million tokens. Cache write assumes the 5-minute ephemeral rate (1.25x input). Excludes any per-search fees,
// which are not modelled here: check the current pricing page before quoting a total to users.
export const PRICES = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};

export const SUBMIT_TOOL = {
  name: "submit_story",
  description: "Submit the finished story.json and theme.json for validation. Returns errors to fix and warnings to read. Call it only with a complete draft; call it again after fixing errors.",
  input_schema: {
    type: "object",
    properties: {
      story: { type: "object", description: "The full story.json object (schemaVersion 1)." },
      theme: { type: "object", description: "The full theme.json object (schemaVersion 1)." },
    },
    required: ["story", "theme"],
  },
};

export function costOf(usage, model) {
  const p = PRICES[model];
  if (!p || !usage) return null;
  return ((usage.input_tokens || 0) * p.input + (usage.output_tokens || 0) * p.output + (usage.cache_read_input_tokens || 0) * p.cacheRead + (usage.cache_creation_input_tokens || 0) * p.cacheWrite) / 1e6;
}

export function buildRequest({ assets, input, model = "claude-opus-5-5", effort = "high", maxSearches = 30, maxFetches = 40, fallbacks = true, today }) {
  return {
    model,
    max_tokens: 64000,
    cache_control: { type: "ephemeral" },
    output_config: { effort },
    system: buildSystemPrompt(assets, { today }),
    tools: [
      { type: "web_search_20260209", name: "web_search", max_uses: maxSearches },
      { type: "web_fetch_20260209", name: "web_fetch", max_uses: maxFetches },
      SUBMIT_TOOL,
    ],
    messages: [{ role: "user", content: buildUserMessage(input) }],
    ...(fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
  };
}

const clip = (s, n = 6000) => (s.length > n ? s.slice(0, n) + " ...[truncated]" : s);
const asText = (o) => clip(JSON.stringify(o));

export async function runStory({ client, assets, input, model = "claude-opus-5-5", effort = "high", maxUsd = 5, maxTurns = 40, maxSearches, maxFetches, fallbacks = true, onEvent = () => {}, signal, now = () => Date.now() }) {
  const t0 = now();
  const today = new Date(t0).toISOString().slice(0, 10);
  const params = buildRequest({ assets, input, model, effort, maxSearches, maxFetches, fallbacks, today });
  const messages = params.messages;
  const ledger = createLedger();
  const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
  const m = { turns: 0, pauses: 0, truncations: 0, nudges: 0, searches: 0, fetches: 0, submissions: [], provenance: null };
  let accepted = null, finalText = "", stop = "turn_limit", error = null;

  const spend = () => costOf(usage, model);
  const finish = () => ({
    ok: !!accepted, stop, error, summary: finalText,
    story: accepted && accepted.story, theme: accepted && accepted.theme, warnings: accepted ? accepted.warnings : [],
    html: accepted ? renderWithTemplate(accepted.story, accepted.theme, assets.template) : null,
    metrics: { ...m, usage: { ...usage }, costUsd: spend(), wallMs: now() - t0, provenance: accepted ? accepted.provenance : m.provenance, model, effort },
  });

  function handleSubmit(inp) {
    if (!inp || typeof inp.story !== "object" || !inp.story || typeof inp.theme !== "object" || !inp.theme) {
      m.submissions.push({ errors: 1, warnings: 0 });
      return { ok: false, errors: ["submit_story needs {story, theme} objects"], warnings: [] };
    }
    const story = structuredClone(inp.story), theme = structuredClone(inp.theme);
    for (const s of story.sources || []) s.accessed = today; // the clock, not the model, sets this
    story.generated = { ...(story.generated || {}), date: today };
    if (!Array.isArray(story.nodes) || !Array.isArray(story.sources) || !Array.isArray(story.edges)) {
      m.submissions.push({ errors: 1, warnings: 0 });
      return { ok: false, errors: ["story must have nodes, edges and sources arrays"], warnings: [] };
    }
    const a = validateStory(story), b = validateTheme(theme, story), p = checkProvenance(story, ledger, { today });
    const errors = [...a.errors.map((e) => `story: ${e}`), ...b.errors.map((e) => `theme: ${e}`), ...p.errors];
    const warnings = [...a.warnings.map((w) => `story: ${w}`), ...b.warnings.map((w) => `theme: ${w}`), ...p.warnings];
    m.submissions.push({ errors: errors.length, warnings: warnings.length });
    m.provenance = p.stats;
    onEvent({ type: "submit", errors: errors.length, warnings: warnings.length });
    if (errors.length) return { ok: false, errors, warnings };
    accepted = { story, theme, warnings, provenance: p.stats };
    return { ok: true, warnings, note: "Accepted. If a warning is worth fixing and you can do it quickly, fix it and resubmit; otherwise reply with your short plain-text summary." };
  }

  const call = async () => {
    const stream = client.beta.messages.stream({ ...params, messages }, signal ? { signal } : undefined);
    if (stream.on) stream.on("text", (delta) => onEvent({ type: "text", delta }));
    return stream.finalMessage();
  };

  try {
    for (let turn = 1; turn <= maxTurns; turn++) {
      if (signal && signal.aborted) { stop = "cancelled"; break; }
      const c = spend();
      if (c !== null && c >= maxUsd) { stop = "budget"; break; }
      onEvent({ type: "turn", n: turn, costUsd: c });
      const msg = await call();
      m.turns++;
      for (const k of Object.keys(usage)) usage[k] += (msg.usage && msg.usage[k]) || 0;
      ledger.ingest(msg.content);
      messages.push({ role: "assistant", content: msg.content });
      for (const b of msg.content) {
        if (b.type === "server_tool_use" && b.name === "web_search") { m.searches++; onEvent({ type: "search", query: b.input && b.input.query }); }
        if (b.type === "server_tool_use" && b.name === "web_fetch") { m.fetches++; onEvent({ type: "fetch", url: b.input && b.input.url }); }
        if (b.type === "text") finalText = b.text;
      }
      if (msg.stop_reason === "refusal") { stop = "refusal"; error = (msg.stop_details && (msg.stop_details.explanation || msg.stop_details.category)) || "the model declined this request"; break; }
      if (msg.stop_reason === "pause_turn") { m.pauses++; continue; }

      const uses = msg.content.filter((b) => b.type === "tool_use");
      if (msg.stop_reason === "max_tokens") m.truncations++;
      if (uses.length) {
        const results = uses.map((u) => {
          if (msg.stop_reason === "max_tokens") return { type: "tool_result", tool_use_id: u.id, is_error: true, content: "Your response was cut off before the tool input finished. Resubmit a more compact story: shorter summaries, fewer nodes if needed." };
          if (u.name !== "submit_story") return { type: "tool_result", tool_use_id: u.id, is_error: true, content: `Unknown tool ${u.name}` };
          const r = handleSubmit(u.input);
          return { type: "tool_result", tool_use_id: u.id, is_error: !r.ok, content: asText(r) };
        });
        messages.push({ role: "user", content: results });
        continue;
      }
      if (accepted) { stop = "done"; break; }
      if (msg.stop_reason === "max_tokens") { messages.push({ role: "user", content: "Your last response was cut off. Continue, and keep it compact." }); continue; }
      if (m.nudges >= 2) { stop = "no_submission"; break; }
      m.nudges++;
      messages.push({ role: "user", content: "You have not submitted a valid story yet. If the subject is allowed and you have enough sources, call submit_story with the full story and theme; if you cannot continue, say why." });
    }
  } catch (e) {
    stop = signal && signal.aborted ? "cancelled" : "error";
    error = String(e && e.message ? e.message : e).replace(/sk-ant-[A-Za-z0-9_-]+/g, "[key]");
  }
  return finish();
}
