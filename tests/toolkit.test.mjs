// Run: node --test tests/toolkit.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateStory, validateTheme } from "../scripts/validate.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = path.join(root, "scripts", "build.mjs");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// Every folder with a story.json under examples/ and stories/ must validate with no errors.
// Folders under examples/ are the published reference set, so they are also held to: zero warnings and an up-to-date index.html.
const storyDirs = [];
for (const top of ["examples", "stories"]) {
  const base = path.join(root, top);
  if (fs.existsSync(base)) for (const d of fs.readdirSync(base).sort()) if (fs.existsSync(path.join(base, d, "story.json"))) storyDirs.push(path.join(base, d));
}
assert.ok(storyDirs.length > 0, "expected at least one example");

// Fixture: a fresh copy of the first example each time.
const fixtureDir = storyDirs[0];
const example = () => ({ story: read(path.join(fixtureDir, "story.json")), theme: read(path.join(fixtureDir, "theme.json")) });

for (const dir of storyDirs) {
  const rel = path.relative(root, dir), isExample = rel.split(path.sep)[0] === "examples";
  test(`${rel}: story and theme validate with no errors`, () => {
    const s = read(path.join(dir, "story.json")), t = read(path.join(dir, "theme.json"));
    assert.deepEqual(validateStory(s).errors, []);
    assert.deepEqual(validateTheme(t, s).errors, []);
  });
  if (!isExample) continue;
  test(`${rel}: has no warnings`, () => {
    const s = read(path.join(dir, "story.json")), t = read(path.join(dir, "theme.json"));
    assert.deepEqual(validateStory(s).warnings, []);
    assert.deepEqual(validateTheme(t, s).warnings, []);
  });
  test(`${rel}: index.html is up to date with its sources`, () => {
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "st-")), "index.html");
    execFileSync("node", [build, dir, "--out", out], { stdio: "pipe" });
    const norm = (s) => s.replace(/\r\n/g, "\n");
    assert.equal(norm(fs.readFileSync(out, "utf8")), norm(fs.readFileSync(path.join(dir, "index.html"), "utf8")), `stale: run node scripts/build.mjs ${rel}`);
  });
}

test("rejects a node with no sources", () => {
  const { story } = example(); story.nodes[1].sources = [];
  assert.ok(validateStory(story).errors.some((e) => /no sources/.test(e)));
});
test("rejects an explicit edge with no source", () => {
  const { story } = example();
  const e = story.edges.find((x) => x.kind === "explicit"); e.sources = [];
  assert.ok(validateStory(story).errors.some((m) => /explicit/.test(m)));
});
test("rejects a dangling edge and an unknown source", () => {
  const { story } = example();
  story.edges.push({ source: story.root, target: "nope", label: "x", kind: "inferred" });
  story.nodes[2].sources = ["ghost"];
  const e = validateStory(story).errors.join("\n");
  assert.match(e, /missing node/); assert.match(e, /unknown source 'ghost'/);
});
test("rejects a non-http source url (javascript:)", () => {
  const { story } = example(); story.sources[0].url = "javascript:alert(1)";
  assert.ok(validateStory(story).errors.some((e) => /http\(s\) url/.test(e)));
});
test("rejects an accent that disappears on the background", () => {
  const { story, theme } = example(); theme.colors.accent = theme.colors.bg;
  assert.ok(validateTheme(theme, story).errors.some((e) => /accent on bg contrast/.test(e)));
});
test("rejects unreadable body text", () => {
  const { story, theme } = example(); theme.colors.text = theme.colors.bg;
  assert.ok(validateTheme(theme, story).errors.some((e) => /text on bg contrast/.test(e)));
});
test("warns when two cluster colours are near-identical", () => {
  const { story, theme } = example();
  const [a, b] = Object.keys(theme.clusters); theme.clusters[b] = theme.clusters[a];
  assert.ok(validateTheme(theme, story).warnings.some((w) => /near-identical/.test(w)));
});
test("warns when most edges are inferred", () => {
  const { story } = example(); for (const e of story.edges) e.kind = "inferred";
  assert.ok(validateStory(story).warnings.some((w) => /inferred/.test(w)));
});

test("accepts ISO-style, year-only and BCE node dates", () => {
  const { story } = example();
  Object.assign(story.nodes[1], { start: "1666-09-02", end: "1666-09-06" });
  Object.assign(story.nodes[2], { start: "-0500" });
  Object.assign(story.nodes[3], { start: "1666" });
  assert.deepEqual(validateStory(story).errors, []);
});
test("rejects malformed node dates and end-before-start", () => {
  const { story } = example();
  story.nodes[1].start = "2 Sept 1666";
  story.nodes[2].start = "1666-13-01";
  Object.assign(story.nodes[3], { start: "1700", end: "1600" });
  const e = validateStory(story).errors.join("\n");
  assert.ok((e.match(/start must look like/g) || []).length >= 2);
  assert.match(e, /ends before it starts/);
});
test("rejects unknown views and defaultView", () => {
  const { story } = example(); story.views = ["graph", "pie"]; story.defaultView = "globe";
  const e = validateStory(story).errors.join("\n");
  assert.match(e, /'views' must be/); assert.match(e, /'defaultView' must be/);
});
test("warns when too few nodes are dated for a timeline", () => {
  const { story } = example();
  for (const n of story.nodes) { delete n.start; delete n.end; }
  story.nodes[1].start = "1990"; story.nodes[2].start = "1995";
  assert.ok(validateStory(story).warnings.some((w) => /Timeline view needs at least 5/.test(w)));
});

test("build inlines everything and data cannot break out of its <script> block", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "st-"));
  const { story, theme } = example();
  const evil = "</script><script>window.__pwned=1</script><!--";
  story.nodes[1].title = evil; story.nodes[1].summary = evil; story.title = evil; story.tagline = evil;
  fs.writeFileSync(path.join(tmp, "story.json"), JSON.stringify(story));
  fs.writeFileSync(path.join(tmp, "theme.json"), JSON.stringify(theme));
  execFileSync("node", [build, tmp], { stdio: "pipe" });
  const html = fs.readFileSync(path.join(tmp, "index.html"), "utf8");
  const tpl = fs.readFileSync(path.join(root, "template", "story.html"), "utf8");
  const count = (s, re) => (s.match(re) || []).length;
  assert.equal(count(html, /<script/gi), count(tpl, /<script/gi), "no extra <script> tags injected");
  assert.equal(count(html, /<\/script/gi), count(tpl, /<\/script/gi));
  assert.ok(!/(?:^|[^&])<script>window\.__pwned/.test(html));
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(html), "all placeholders filled");
});

test("build exits non-zero on invalid input and writes nothing", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "st-"));
  const { story, theme } = example(); story.nodes[1].sources = [];
  fs.writeFileSync(path.join(tmp, "story.json"), JSON.stringify(story));
  fs.writeFileSync(path.join(tmp, "theme.json"), JSON.stringify(theme));
  const r = spawnSync("node", [build, tmp], { encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.ok(!fs.existsSync(path.join(tmp, "index.html")));
});

test("rendered page contains every view container and the view switcher", () => {
  const html = fs.readFileSync(path.join(fixtureDir, "index.html"), "utf8");
  for (const id of ['id="graph"', 'id="timeline"', 'id="read"', 'id="outline"', 'id="list"', 'id="views"']) assert.ok(html.includes(id), id);
});

test("no reference file mentions a local machine path or a placeholder token", () => {
  for (const f of ["AGENTS.md", "README.md", ...fs.readdirSync(path.join(root, "playbook")).map((x) => path.join("playbook", x))]) {
    const t = fs.readFileSync(path.join(root, f), "utf8");
    assert.ok(!/[A-Z]:\\(Users|dev)\\/.test(t), `${f} contains a local path`);
    assert.ok(!/TODO|FIXME|XXX/.test(t), `${f} contains a TODO marker`);
  }
});

test("warns when one far-off date would stretch the timeline axis", () => {
  const { story } = example();
  for (const n of story.nodes) { delete n.start; delete n.end; }
  story.nodes.slice(0, 10).forEach((n, i) => { n.start = `1666-09-${String(i + 1).padStart(2, "0")}`; });
  assert.ok(!validateStory(story).warnings.some((w) => /outlier/.test(w)));
  story.nodes[10].start = "1830";
  assert.ok(validateStory(story).warnings.some((w) => /outlier/.test(w)));
});

test("warns when a node rests only on Wikipedia", () => {
  const { story } = example();
  story.sources.push({ id: "wp-test", title: "Test", url: "https://en.wikipedia.org/wiki/Test", accessed: "2026-01-01" });
  story.nodes[1].sources = ["wp-test"];
  assert.ok(validateStory(story).warnings.some((w) => /rests only on Wikipedia/.test(w)));
  story.nodes[1].sources = ["wp-test", story.sources[0].id];
  assert.ok(!validateStory(story).warnings.some((w) => /node '.*' rests only on Wikipedia/.test(w)));
});

test("fetch-text and brand-probe refuse non-http input", () => {
  for (const script of ["fetch-text.mjs", "brand-probe.mjs"]) {
    const r = spawnSync("node", [path.join(root, "scripts", script), "file:///etc/passwd"], { encoding: "utf8" });
    assert.equal(r.status, 2, script);
  }
});
