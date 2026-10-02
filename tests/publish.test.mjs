// Run: node --test tests/publish.test.mjs
// End to end: scripts/publish.mjs against the reference service (services/publish) on a real local port.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHandler, memoryLimiter, LIMITS } from "../services/publish/handler.mjs";
import { nodeListener } from "../services/publish/server.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publish = path.join(root, "scripts", "publish.mjs");
const example = path.join(root, "examples", "salary");

let server, base, handler;
before(async () => {
  server = http.createServer(nodeListener((req, ctx) => handler(req, ctx)));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  handler = createHandler({ baseUrl: base, limiter: memoryLimiter({ max: 100 }) });
});
after(() => server.close());

const copyStory = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "pub-"));
  for (const f of ["story.json", "theme.json"]) fs.copyFileSync(path.join(example, f), path.join(d, f));
  return d;
};
// Async on purpose: the service runs in this process, so a blocking spawnSync would deadlock it.
const exec = (args, env = process.env) => new Promise((resolve) => {
  const c = spawn(process.execPath, [publish, ...args], { env });
  let stdout = "", stderr = "";
  c.stdout.on("data", (d) => (stdout += d));
  c.stderr.on("data", (d) => (stderr += d));
  c.on("close", (status) => resolve({ status, stdout, stderr }));
});
const run = (dir, ...a) => exec([dir, "--to", base, ...a]);
const post = (body) => handler(new Request("http://x/v1/stories", { method: "POST", body: JSON.stringify(body) }));

test("publish without --yes is a dry run and sends nothing", async () => {
  const d = copyStory();
  const r = await run(d);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Dry run/);
  assert.ok(!fs.existsSync(path.join(d, ".publish.json")));
});

test("create, view, update and delete round trip", async () => {
  const d = copyStory();
  let r = await run(d, "--yes");
  assert.equal(r.status, 0, r.stderr);
  const receipt = JSON.parse(fs.readFileSync(path.join(d, ".publish.json"), "utf8"));
  assert.match(receipt.id, /^[a-z2-7]{12}$/);
  assert.ok(receipt.editToken.length >= 40);

  const page = await fetch(`${base}/s/${receipt.id}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("x-robots-tag"), /noindex/);
  assert.match(page.headers.get("content-security-policy"), /default-src 'none'/);
  assert.match(await page.text(), /<script/);

  assert.notEqual((await run(d, "--yes")).status, 0, "a second create is refused");
  r = await run(d, "--update", "--yes");
  assert.equal(r.status, 0, r.stderr);

  r = await run(d, "--delete", "--yes");
  assert.equal(r.status, 0, r.stderr);
  assert.equal((await fetch(`${base}/s/${receipt.id}/`)).status, 404);
  assert.ok(!fs.existsSync(path.join(d, ".publish.json")));
});

test("service: update and delete need the edit token", async () => {
  const story = JSON.parse(fs.readFileSync(path.join(example, "story.json"), "utf8"));
  const theme = JSON.parse(fs.readFileSync(path.join(example, "theme.json"), "utf8"));
  const created = await (await post({ story, theme })).json();
  const del = (token) => handler(new Request(`http://x/v1/stories/${created.id}`, { method: "DELETE", headers: token ? { authorization: `Bearer ${token}` } : {} }));
  assert.equal((await del()).status, 403);
  assert.equal((await del("wrong-token")).status, 403);
  assert.equal((await del(created.editToken)).status, 200);
});

test("service: refuses invalid, oversized, private and uncredited stories", async () => {
  const story = JSON.parse(fs.readFileSync(path.join(example, "story.json"), "utf8"));
  const theme = JSON.parse(fs.readFileSync(path.join(example, "theme.json"), "utf8"));
  const unsourced = structuredClone(story);
  unsourced.nodes[1].sources = [];
  assert.equal((await post({ story: unsourced, theme })).status, 422);
  assert.equal((await post({ story: { ...story, subject: { ...story.subject, kind: "relationship" } }, theme })).status, 422);
  const { credit, ...noCredit } = story;
  assert.equal((await post({ story: noCredit, theme })).status, 422);
  assert.equal((await post({ nope: true })).status, 422);
  const big = await handler(new Request("http://x/v1/stories", { method: "POST", body: " ".repeat(LIMITS.bodyBytes + 1) }));
  assert.equal(big.status, 413);
  const bad = await handler(new Request("http://x/v1/stories", { method: "POST", body: "{not json" }));
  assert.equal(bad.status, 400);
});

test("service: rate limit, malformed ids and unknown routes", async () => {
  const limited = createHandler({ baseUrl: base, limiter: memoryLimiter({ max: 1 }) });
  const story = JSON.parse(fs.readFileSync(path.join(example, "story.json"), "utf8"));
  const theme = JSON.parse(fs.readFileSync(path.join(example, "theme.json"), "utf8"));
  const send = () => limited(new Request("http://x/v1/stories", { method: "POST", body: JSON.stringify({ story, theme }) }));
  assert.equal((await send()).status, 201);
  assert.equal((await send()).status, 429);
  assert.equal((await handler(new Request("http://x/s/../../etc/passwd"))).status, 404);
  assert.equal((await handler(new Request("http://x/s/ABCDEFGHIJKL/"))).status, 404);
  assert.equal((await handler(new Request("http://x/other"))).status, 404);
});

test("client refuses a non-https service and a missing service", async () => {
  const d = copyStory();
  const r1 = await exec([d, "--to", "http://example.com", "--yes"]);
  assert.notEqual(r1.status, 0);
  assert.match(r1.stderr, /https/);
  const r2 = await exec([d, "--yes"], { ...process.env, STORYTELLER_PUBLISH_URL: "" });
  assert.notEqual(r2.status, 0);
  assert.match(r2.stderr, /no publishing service/);
});

test("a theme cannot smuggle markup through colours (stored XSS)", async () => {
  const story = JSON.parse(fs.readFileSync(path.join(example, "story.json"), "utf8"));
  const theme = JSON.parse(fs.readFileSync(path.join(example, "theme.json"), "utf8"));
  for (const line of ["red}</style><script>alert(1)</script>", "rgba(0,0,0,1);}</style>", "url(https://x.test/a)"]) {
    const res = await post({ story, theme: { ...theme, colors: { ...theme.colors, line } } });
    assert.equal(res.status, 422, line);
  }
});

test("published pages only allow the template's own scripts (CSP hashes)", async () => {
  const story = JSON.parse(fs.readFileSync(path.join(example, "story.json"), "utf8"));
  const theme = JSON.parse(fs.readFileSync(path.join(example, "theme.json"), "utf8"));
  const { id } = await (await post({ story, theme })).json();
  const res = await fetch(`${base}/s/${id}/`);
  const csp = res.headers.get("content-security-policy");
  assert.match(csp, /script-src 'sha256-[A-Za-z0-9+/=]+'/);
  assert.ok(!/script-src[^;]*unsafe-inline/.test(csp));
});

test("rate limit key cannot be forged with X-Forwarded-For unless a proxy is trusted", async () => {
  const story = JSON.parse(fs.readFileSync(path.join(example, "story.json"), "utf8"));
  const theme = JSON.parse(fs.readFileSync(path.join(example, "theme.json"), "utf8"));
  const send = (h, ip, xff) => h(new Request("http://x/v1/stories", { method: "POST", body: JSON.stringify({ story, theme }), headers: { "x-forwarded-for": xff } }), { ip });
  const direct = createHandler({ limiter: memoryLimiter({ max: 1 }) });
  assert.equal((await send(direct, "10.0.0.1", "1.1.1.1")).status, 201);
  assert.equal((await send(direct, "10.0.0.1", "2.2.2.2")).status, 429, "a rotated header does not reset the limit");
  assert.equal((await send(direct, "10.0.0.2", "1.1.1.1")).status, 201, "a different socket address has its own limit");
  const proxied = createHandler({ limiter: memoryLimiter({ max: 1 }), trustProxy: true });
  assert.equal((await send(proxied, "10.0.0.9", "6.6.6.6, 7.7.7.7")).status, 201);
  assert.equal((await send(proxied, "10.0.0.9", "5.5.5.5, 7.7.7.7")).status, 429, "keyed by the proxy-added (right-most) address");
});

test("rate limiter memory is bounded", () => {
  const l = memoryLimiter({ max: 5, maxKeys: 100 });
  for (let i = 0; i < 1000; i++) assert.equal(l.allow("k" + i), true);
  assert.equal(l.allow("k999"), true);
});

test("transport stops oversized bodies while streaming", async () => {
  const declared = await fetch(`${base}/v1/stories`, { method: "POST", body: "x".repeat(LIMITS.bodyBytes + 10) });
  assert.equal(declared.status, 413);
  const chunked = await new Promise((resolve) => {
    const req = http.request(`${base}/v1/stories`, { method: "POST", headers: { "transfer-encoding": "chunked" } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on("error", () => resolve("closed"));
    const chunk = "x".repeat(200_000);
    let n = 0;
    const pump = () => { if (n++ < 20 && req.write(chunk)) return pump(); if (n <= 20) req.once("drain", pump); else req.end(); };
    pump();
  });
  assert.ok(chunked === 413 || chunked === "closed", `got ${chunked}`);
});
