// Reference publishing service (a sketch). Framework-neutral: createHandler() returns (Request) => Promise<Response>,
// so it runs under Node's http server (see server.mjs), a serverless function, or a Worker.
// It never serves client-supplied HTML: clients send story.json + theme.json, and the service validates them and renders
// the page itself with the same template the local build uses. See docs/publishing.md for the design.
import crypto from "node:crypto";
import { validateStory, validateTheme } from "../../scripts/validate.mjs";
import { renderStory } from "../../scripts/render.mjs";

export const LIMITS = { bodyBytes: 1_000_000, nodes: 200, edges: 500, sources: 200 };

const ID_RE = /^[a-z2-7]{12}$/;
const B32 = "abcdefghijklmnopqrstuvwxyz234567";
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const newId = () => Array.from(crypto.randomBytes(12), (b) => B32[b & 31]).join("");
const newToken = () => crypto.randomBytes(32).toString("base64url");
const reply = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
const safeEqual = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// Headers for the published pages. They hold inline script and data, so they get no network access at all.
// Only the template's own scripts may run: script-src lists their SHA-256 hashes, so injected markup would not execute
// even if a validation gap let some through. (JSON data blocks are not scripts and need no entry.)
export function pageHeaders(html) {
  const hashes = [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash("sha256").update(m[1]).digest("base64")}'`);
  return {
    "content-type": "text/html; charset=utf-8",
    "x-robots-tag": "noindex, nofollow",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": `default-src 'none'; script-src ${hashes.join(" ") || "'none'"}; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    "cache-control": "public, max-age=300",
  };
}

// ---- storage adapter: { get(id), put(id, record), delete(id) }. Swap in object storage or a KV store in production. ----
export function memoryStore() {
  const m = new Map();
  return { async get(id) { return m.get(id) ?? null; }, async put(id, rec) { m.set(id, rec); }, async delete(id) { m.delete(id); } };
}

// ---- rate limiter: { allow(key) -> boolean }. This one is a per-process sketch; use a shared store in production. ----
export function memoryLimiter({ max = 10, windowMs = 3_600_000, maxKeys = 10_000 } = {}) {
  const hits = new Map();
  return {
    allow(key) {
      const now = Date.now();
      const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
      if (recent.length >= max) { hits.set(key, recent); return false; }
      recent.push(now);
      hits.delete(key);
      hits.set(key, recent); // re-insert so the Map stays ordered oldest-activity first
      if (hits.size > maxKeys) { // bounded memory: drop the least recently active keys
        for (const k of hits.keys()) { if (hits.size <= maxKeys) break; hits.delete(k); }
      }
      return true;
    },
  };
}

// policy(story) -> string[] of reasons to refuse. The default blocks private-relationship stories and anything without credit and disclaimer.
export function defaultPolicy(story) {
  const why = [];
  if (story.subject?.kind === "relationship") why.push("stories about private relationships cannot be published publicly");
  if (!story.credit || !story.disclaimer) why.push("credit and disclaimer are required for published stories");
  return why;
}

function check(body) {
  if (!body || typeof body !== "object" || !body.story || typeof body.story !== "object" || !body.theme || typeof body.theme !== "object") return { errors: ["body must be {story, theme}"] };
  const { story, theme } = body;
  const errors = [];
  if (story.nodes?.length > LIMITS.nodes) errors.push(`too many nodes (max ${LIMITS.nodes})`);
  if (story.edges?.length > LIMITS.edges) errors.push(`too many edges (max ${LIMITS.edges})`);
  if (story.sources?.length > LIMITS.sources) errors.push(`too many sources (max ${LIMITS.sources})`);
  if (errors.length) return { errors };
  const a = validateStory(story), b = validateTheme(theme, story);
  return { errors: [...a.errors.map((m) => `story: ${m}`), ...b.errors.map((m) => `theme: ${m}`)], story, theme };
}

export function createHandler({ store = memoryStore(), limiter = memoryLimiter(), policy = defaultPolicy, baseUrl = "http://localhost:8787", trustProxy = false, clientKey } = {}) {
  // The rate-limit key is the caller's socket address, passed by the transport as ctx.ip. X-Forwarded-For is client-controlled,
  // so it is ignored unless trustProxy is set, which is only correct behind a proxy that appends the real address
  // (the right-most entry is the one that proxy added).
  const keyOf = clientKey || ((req, ctx) => {
    if (trustProxy) { const xff = (req.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean); if (xff.length) return xff[xff.length - 1]; }
    return ctx.ip || "local";
  });
  const base = baseUrl.replace(/\/$/, "");

  async function prepare(req) {
    const text = await req.text();
    if (Buffer.byteLength(text) > LIMITS.bodyBytes) return { res: reply(413, { error: `body over ${LIMITS.bodyBytes} bytes` }) };
    let body;
    try { body = JSON.parse(text); } catch { return { res: reply(400, { error: "body is not valid JSON" }) }; }
    const c = check(body);
    if (c.errors.length) return { res: reply(422, { error: "validation failed", details: c.errors }) };
    const refused = policy(c.story);
    if (refused.length) return { res: reply(422, { error: "refused by policy", details: refused }) };
    return { html: renderStory(c.story, c.theme), title: c.story.title };
  }

  async function owner(req, id) {
    const rec = ID_RE.test(id) ? await store.get(id) : null;
    if (!rec) return { res: reply(404, { error: "not found" }) };
    const token = (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
    if (!token || !safeEqual(sha256(token), rec.tokenHash)) return { res: reply(403, { error: "bad edit token" }) };
    return { rec };
  }

  const limited = () => reply(429, { error: "rate limit reached, try again later" }, { "retry-after": "3600" });

  return async function handle(req, ctx = {}) {
    const url = new URL(req.url);
    const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);

    if (req.method === "GET" && parts[0] === "s" && parts.length === 2) {
      const rec = ID_RE.test(parts[1]) ? await store.get(parts[1]) : null;
      return rec ? new Response(rec.html, { headers: pageHeaders(rec.html) }) : reply(404, { error: "not found" });
    }
    if (parts[0] !== "v1" || parts[1] !== "stories") return reply(404, { error: "not found" });

    if (req.method === "POST" && parts.length === 2) {
      if (!limiter.allow(keyOf(req, ctx))) return limited();
      const p = await prepare(req);
      if (p.res) return p.res;
      const id = newId(), token = newToken(), now = new Date().toISOString();
      await store.put(id, { html: p.html, title: p.title, tokenHash: sha256(token), createdAt: now, updatedAt: now });
      return reply(201, { id, url: `${base}/s/${id}/`, editToken: token });
    }
    if ((req.method === "PUT" || req.method === "DELETE") && parts.length === 3) {
      const id = parts[2];
      const o = await owner(req, id);
      if (o.res) return o.res;
      if (req.method === "DELETE") { await store.delete(id); return reply(200, { deleted: id }); }
      if (!limiter.allow(keyOf(req, ctx))) return limited();
      const p = await prepare(req);
      if (p.res) return p.res;
      await store.put(id, { ...o.rec, html: p.html, title: p.title, updatedAt: new Date().toISOString() });
      return reply(200, { id, url: `${base}/s/${id}/` });
    }
    return reply(405, { error: "method not allowed" });
  };
}
