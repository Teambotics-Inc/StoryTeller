// Run: node --test tests/byo-agent.test.mjs
// Tests the bring-your-own-key prototype's loop (prototype/byo-key/) against a scripted fake client: no network, no key.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runStory, buildRequest, costOf, SUBMIT_TOOL } from "../prototype/byo-key/agent.mjs";
import { urlKey, createLedger, checkProvenance } from "../prototype/byo-key/provenance.mjs";
import { loadAssets } from "../prototype/byo-key/assets.mjs";
import { renderStory } from "../scripts/render.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = loadAssets();
const example = (n) => JSON.parse(fs.readFileSync(path.join(root, "examples", "salary", n), "utf8"));
const goodStory = () => example("story.json"), goodTheme = () => example("theme.json");

// Server-tool result blocks for every source URL of a story, as the API would return them. `text` is each page's text.
const fetchBlocks = (story, textOf = () => "") => story.sources.flatMap((s, i) => [
  { type: "server_tool_use", id: `f${i}`, name: "web_fetch", input: { url: s.url } },
  { type: "web_fetch_tool_result", tool_use_id: `f${i}`, content: { type: "web_fetch_result", url: s.url, content: { type: "document", source: { type: "text", media_type: "text/plain", data: textOf(s) } } } },
]);
const usage = (o = {}) => ({ input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, ...o });
const submit = (story, theme, id = "t1") => ({ type: "tool_use", id, name: "submit_story", input: { story, theme } });
const turn = (content, stop_reason = "tool_use", u = usage()) => ({ content, stop_reason, usage: u });

// Fake SDK client: returns scripted messages in order and records each request (deep-copied) for assertions.
function fakeClient(script) {
  const calls = [];
  return {
    calls,
    beta: { messages: { stream: (params, opts) => {
      calls.push({ messages: structuredClone(params.messages), params: { ...params, messages: undefined }, opts });
      const next = script.shift();
      if (!next) throw new Error("script exhausted");
      return { finalMessage: async () => (typeof next === "function" ? next(params) : next) };
    } } },
  };
}
const run = (script, extra = {}) => { const client = fakeClient(script); return runStory({ client, assets, input: { subject: "salary" }, now: () => 1_750_000_000_000, ...extra }).then((r) => ({ r, client })); };

test("happy path: research, submit, accepted, final summary", async () => {
  const s = goodStory();
  const { r, client } = await run([
    turn([...fetchBlocks(s), submit(s, goodTheme())]),
    turn([{ type: "text", text: "Done: 26 nodes." }], "end_turn"),
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.stop, "done");
  assert.equal(r.summary, "Done: 26 nodes.");
  assert.match(r.html, /<script/);
  assert.equal(r.story.generated.date, "2025-06-15");
  assert.ok(r.story.sources.every((x) => x.accessed === "2025-06-15"), "accessed is set by the page clock");
  assert.equal(r.metrics.fetches, s.sources.length);
  assert.equal(r.metrics.provenance.fetched, s.sources.length);
  assert.equal(r.metrics.turns, 2);
  assert.equal(client.calls.length, 2);
});

test("a source the agent never fetched is rejected with a clear error, then fixed", async () => {
  const s = goodStory();
  const bad = structuredClone(s);
  bad.sources.push({ id: "ghost", title: "Never read", url: "https://example.org/never-fetched" });
  bad.nodes[1].sources = [...bad.nodes[1].sources, "ghost"];
  const { r, client } = await run([
    turn([...fetchBlocks(s), submit(bad, goodTheme(), "t1")]),
    turn([submit(s, goodTheme(), "t2")]),
    turn([{ type: "text", text: "ok" }], "end_turn"),
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.metrics.submissions.map((x) => x.errors > 0), [true, false]);
  const feedback = JSON.parse(client.calls[1].messages.at(-1).content[0].content);
  assert.equal(feedback.ok, false);
  assert.match(feedback.errors.join("\n"), /ghost.*does not appear in any web_search or web_fetch result/);
  assert.equal(client.calls[1].messages.at(-1).content[0].is_error, true);
});

test("a source seen only as a search result is a warning, not an error", () => {
  const s = goodStory();
  const ledger = createLedger();
  ledger.ingest([{ type: "web_search_tool_result", tool_use_id: "x", content: s.sources.map((x) => ({ type: "web_search_result", url: x.url, title: x.title })) }]);
  const p = checkProvenance(s, ledger, { today: "2025-06-15" });
  assert.equal(p.errors.length, 0);
  assert.equal(p.stats.snippetOnly, s.sources.length);
  assert.ok(p.warnings.some((w) => /only seen as a search result/.test(w)));
});

test("evidence is checked against fetched text: verbatim passes, wrong figures warn", () => {
  const s = goodStory();
  const node = s.nodes.find((n) => n.evidence && /\d/.test(n.evidence)) || s.nodes[1];
  const only = { ...s, nodes: [{ ...node, evidence: "The tower is 324 metres tall.", sources: [node.sources[0]] }], sources: s.sources.filter((x) => x.id === node.sources[0]) };
  const mk = (text) => { const l = createLedger(); l.ingest(fetchBlocks(only, () => text)); return checkProvenance(only, l); };
  assert.equal(mk("Facts: the Tower is 324 metres tall. More text.").stats.evidenceExact, 1);
  const wrong = mk("Facts: the tower is 330 metres tall.");
  assert.equal(wrong.stats.evidenceExact, 0);
  assert.ok(wrong.warnings.some((w) => /figures in evidence \(324\)/.test(w)));
});

test("urlKey ignores scheme, www, query, fragment and trailing slash", () => {
  assert.equal(urlKey("https://www.Example.com/a/b/?x=1#frag"), urlKey("http://example.com/a/b"));
  assert.notEqual(urlKey("https://example.com/a"), urlKey("https://example.com/b"));
});

test("validator errors are fed back and the loop continues until the draft passes", async () => {
  const s = goodStory();
  const broken = structuredClone(s);
  broken.edges.push({ source: "no-such-node", target: broken.root, label: "x", kind: "explicit", sources: [s.sources[0].id] });
  const { r, client } = await run([
    turn([...fetchBlocks(s), submit(broken, goodTheme(), "t1")]),
    turn([submit(s, goodTheme(), "t2")]),
    turn([{ type: "text", text: "fixed" }], "end_turn"),
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.metrics.submissions.length, 2);
  assert.match(client.calls[1].messages.at(-1).content[0].content, /no-such-node|dangling|unknown/i);
});

test("conversation is append-only: earlier messages are never edited between calls", async () => {
  const s = goodStory();
  const { client } = await run([
    turn([...fetchBlocks(s), submit(s, goodTheme())]),
    turn([{ type: "text", text: "done" }], "end_turn"),
  ]);
  const [first, second] = client.calls;
  assert.deepEqual(second.messages.slice(0, first.messages.length), first.messages);
  assert.equal(second.messages.length, first.messages.length + 2);
});

test("pause_turn resumes without adding a user turn", async () => {
  const s = goodStory();
  const { r, client } = await run([
    turn([{ type: "text", text: "searching" }], "pause_turn"),
    turn([...fetchBlocks(s), submit(s, goodTheme())]),
    turn([{ type: "text", text: "ok" }], "end_turn"),
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.metrics.pauses, 1);
  assert.equal(client.calls[1].messages.at(-1).role, "assistant");
});

test("max_tokens mid tool call: tool_result error asks for a compact resubmission", async () => {
  const s = goodStory();
  const { r, client } = await run([
    turn([...fetchBlocks(s), submit({ title: "cut off" }, goodTheme(), "t1")], "max_tokens"),
    turn([submit(s, goodTheme(), "t2")]),
    turn([{ type: "text", text: "ok" }], "end_turn"),
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.metrics.truncations, 1);
  assert.match(client.calls[1].messages.at(-1).content[0].content, /cut off/);
});

test("refusal stops the run with the reason and no result", async () => {
  const { r } = await run([{ content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: "bio", explanation: "declined" }, usage: usage() }]);
  assert.equal(r.ok, false);
  assert.equal(r.stop, "refusal");
  assert.equal(r.error, "declined");
});

test("spend cap stops the loop before the next call", async () => {
  const { r, client } = await run([
    turn([{ type: "text", text: "thinking" }], "pause_turn", usage({ input_tokens: 1_000_000, output_tokens: 100_000 })), // about $6
    turn([{ type: "text", text: "never reached" }], "end_turn"),
  ], { maxUsd: 1 });
  assert.equal(r.stop, "budget");
  assert.equal(client.calls.length, 1);
  assert.ok(r.metrics.costUsd > 5);
});

test("no submission after two nudges stops with no_submission", async () => {
  const { r } = await run([turn([{ type: "text", text: "hm" }], "end_turn"), turn([{ type: "text", text: "hm" }], "end_turn"), turn([{ type: "text", text: "hm" }], "end_turn")]);
  assert.equal(r.stop, "no_submission");
  assert.equal(r.metrics.nudges, 2);
});

test("cancellation: an aborted signal ends the run cleanly", async () => {
  const ac = new AbortController(); ac.abort();
  const { r, client } = await run([], { signal: ac.signal });
  assert.equal(r.stop, "cancelled");
  assert.equal(client.calls.length, 0);
});

test("API errors never leak the key into the reported error", async () => {
  const { r } = await run([() => { throw new Error("401 invalid x-api-key sk-ant-api03-SECRETSECRET-abc"); }]);
  assert.equal(r.stop, "error");
  assert.ok(!/SECRETSECRET/.test(r.error));
  assert.match(r.error, /\[key\]/);
});

test("request shape: server tools, strict-free submit tool, effort, caching, fallbacks opt-in, no forced tool_choice", () => {
  const req = buildRequest({ assets, input: { subject: "x" }, today: "2026-10-03" });
  assert.equal(req.model, "claude-opus-5-5");
  assert.deepEqual(req.tools.map((t) => t.name), ["web_search", "web_fetch", "submit_story"]);
  assert.equal(req.tools[0].type, "web_search_20260209");
  assert.equal(req.tools[1].type, "web_fetch_20260209");
  assert.equal(req.tools[2], SUBMIT_TOOL);
  assert.equal(req.tool_choice, undefined, "forced tool_choice is rejected by this model");
  assert.equal(req.thinking, undefined, "thinking is always on for this model; leave it unset");
  assert.deepEqual(req.output_config, { effort: "high" });
  assert.deepEqual(req.cache_control, { type: "ephemeral" });
  assert.equal(req.fallbacks, "default");
  assert.deepEqual(req.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(buildRequest({ assets, input: { subject: "x" }, fallbacks: false, today: "2026-10-03" }).fallbacks, undefined);
  assert.match(req.system, /Hard rules/);
  assert.match(req.system, /submit_story/);
  assert.match(req.system, /Today is 2026-10-03/);
});

test("system prompt is built from the repository playbook, so it cannot drift", () => {
  const req = buildRequest({ assets, input: { subject: "x" }, today: "2026-10-03" });
  for (const marker of ["# 1. Scope the story", "# 2. Research", "# 3. Model the story", "# 4. Brand and theme"]) assert.ok(req.system.includes(marker), marker);
  assert.ok(req.system.includes(fs.readFileSync(path.join(root, "template", "default-theme.json"), "utf8").trim().slice(0, 40)));
});

test("browser-safe renderer matches the Node renderer byte for byte", async () => {
  const { renderWithTemplate } = await import("../scripts/render-core.mjs");
  const s = goodStory(), t = goodTheme();
  assert.equal(renderWithTemplate(s, t, assets.template), renderStory(s, t));
});

test("cost arithmetic", () => {
  assert.equal(costOf({ input_tokens: 1_000_000, output_tokens: 1_000_000 }, "claude-opus-5-5"), 24);
  assert.equal(costOf({ cache_read_input_tokens: 1_000_000 }, "claude-opus-5-5"), 0.2);
  assert.equal(costOf({ input_tokens: 5 }, "unknown-model"), null);
});

test("site build: /byo/ page loads no third-party scripts, pins its CSP to the template script, and the header rule excludes it from the global policy", async () => {
  const { execFileSync } = await import("node:child_process");
  const os = await import("node:os"); const crypto = await import("node:crypto");
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "site-"));
  execFileSync(process.execPath, [path.join(root, "scripts", "build-site.mjs")], { env: { ...process.env, SITE_OUT: out }, stdio: "pipe" });
  const page = fs.readFileSync(path.join(out, "byo", "index.html"), "utf8");
  assert.ok(!/<script[^>]+src="https?:/.test(page), "no external script tags");
  assert.ok(!/esm\.sh|cdn\./.test(fs.readFileSync(path.join(out, "byo", "prototype", "byo-key", "web", "app.mjs"), "utf8")), "no CDN imports in app.mjs");
  for (const f of ["scripts/validate.mjs", "scripts/render-core.mjs", "prototype/byo-key/agent.mjs", "prototype/byo-key/provenance.mjs", "prototype/byo-key/prompt.mjs", "prototype/byo-key/web/app.mjs", "prototype/byo-key/web/assets.generated.mjs", "prototype/byo-key/web/vendor/anthropic-sdk.mjs"]) assert.ok(fs.existsSync(path.join(out, "byo", f)), f);
  const csp = /Content-Security-Policy" content="([^"]*)"/.exec(page)[1].replace(/&#39;/g, "'");
  assert.match(csp, /connect-src https:\/\/api\.anthropic\.com;/);
  const tpl = fs.readFileSync(path.join(root, "template", "story.html"), "utf8");
  const inline = [...tpl.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash("sha256").update(m[1]).digest("base64")}'`);
  assert.ok(inline.length >= 1 && inline.every((h) => csp.includes(h)), "CSP carries the template's inline script hash");
  assert.ok(!/script-src[^;]*unsafe-inline/.test(csp));
  assert.match(page, /noindex/);
  const vj = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const globalRule = vj.headers.find((h) => /byo/.test(h.source) && h.source.includes("?!"));
  const byoRule = vj.headers.find((h) => h.source === "/byo/(.*)");
  assert.ok(globalRule && byoRule, "global rule excludes /byo/ and a dedicated rule exists");
  const byoCsp = byoRule.headers.find((h) => h.key === "Content-Security-Policy").value;
  assert.match(byoCsp, /connect-src https:\/\/api\.anthropic\.com/);
  assert.ok(!/connect-src[^;]*\*/.test(byoCsp));
  const home = fs.readFileSync(path.join(out, "index.html"), "utf8");
  assert.match(home, /href="\/byo\/"/);
});
