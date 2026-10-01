// Zero-dependency validation for story.json + theme.json.
// Errors block the build. Warnings are quality nudges the agent should read and act on.

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const SLUG = /^[a-z0-9][a-z0-9-_]*$/i;
const KINDS = new Set(["explicit", "inferred"]);

export function parseHex(c) {
  if (typeof c !== "string" || !HEX.test(c)) return null;
  let h = c.slice(1);
  if (h.length === 3) h = [...h].map((x) => x + x).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
export function luminance([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const DATE = /^-?[0-9]{1,5}(-[0-9]{2}(-[0-9]{2})?)?$/;
export function dateParts(s) {
  if (typeof s !== "string" || !DATE.test(s)) return null;
  const m = /^(-?[0-9]{1,5})(?:-([0-9]{2})(?:-([0-9]{2}))?)?$/.exec(s);
  const y = +m[1], mo = m[2] ? +m[2] : 1, d = m[3] ? +m[3] : 1;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return y + (mo - 1) / 12 + (d - 1) / 372;
}
export const VIEWS = ["graph", "timeline", "read", "outline", "list"];
export const isHttpUrl = (u) => { try { return ["http:", "https:"].includes(new URL(u).protocol); } catch { return false; } };

export function validateStory(s) {
  const errors = [], warnings = [];
  const E = (m) => errors.push(m), W = (m) => warnings.push(m);
  if (!s || typeof s !== "object") return { errors: ["story.json is not an object"], warnings };
  if (s.schemaVersion !== 1) E("schemaVersion must be 1");
  for (const k of ["title", "tagline"]) if (typeof s[k] !== "string" || !s[k].trim()) E(`'${k}' is required (non-empty string)`);
  if (typeof s.tagline === "string" && s.tagline.length > 220) W("tagline is long (>220 chars); aim for one sentence");
  for (const k of ["clusters", "sources", "nodes", "edges"]) if (!Array.isArray(s[k])) E(`'${k}' must be an array`);
  if (errors.length) return { errors, warnings };

  const uniq = (arr, label) => {
    const seen = new Set();
    for (const x of arr) {
      if (!x || typeof x.id !== "string" || !SLUG.test(x.id)) { E(`${label} has a missing/invalid id: ${JSON.stringify(x?.id)}`); continue; }
      if (seen.has(x.id)) E(`duplicate ${label} id '${x.id}'`);
      seen.add(x.id);
    }
    return seen;
  };
  const clusterIds = uniq(s.clusters, "cluster");
  const sourceIds = uniq(s.sources, "source");
  const nodeIds = uniq(s.nodes, "node");
  const srcUrl = new Map(s.sources.map((x) => [x.id, x.url]));
  if (s.clusters.length === 0) E("need at least one cluster");
  if (s.clusters.length > 12) W(`${s.clusters.length} clusters is a lot; 4-9 reads best`);
  for (const c of s.clusters) if (typeof c.label !== "string" || !c.label) E(`cluster '${c.id}' needs a label`);

  for (const src of s.sources) {
    if (typeof src.title !== "string" || !src.title) E(`source '${src.id}' needs a title`);
    if (!isHttpUrl(src.url)) E(`source '${src.id}' needs an http(s) url`);
    if (!src.accessed) W(`source '${src.id}' has no 'accessed' date`);
  }

  if (!nodeIds.has(s.root)) E(`'root' must reference an existing node id (got ${JSON.stringify(s.root)})`);
  const degree = new Map([...nodeIds].map((i) => [i, 0]));
  for (const n of s.nodes) {
    const at = `node '${n.id}'`;
    for (const k of ["title", "summary"]) if (typeof n[k] !== "string" || !n[k].trim()) E(`${at} needs '${k}'`);
    if (!clusterIds.has(n.cluster)) E(`${at} has unknown cluster '${n.cluster}'`);
    if (!Array.isArray(n.sources) || n.sources.length === 0) E(`${at} has no sources (every node must be traceable)`);
    else for (const id of n.sources) if (!sourceIds.has(id)) E(`${at} cites unknown source '${id}'`);
    if (Array.isArray(n.sources) && n.sources.length > 0 && n.sources.every((id) => /(^|\.)wikipedia\.org\//.test(String(srcUrl.get(id) || "")) )) W(`${at} rests only on Wikipedia (tertiary); add a primary or reputable secondary source, or word it as tentative`);
    if (typeof n.summary === "string" && n.summary.length > 320) W(`${at} summary is ${n.summary.length} chars; keep it to 1-2 sentences and move the rest to 'details'`);
    if (typeof n.title === "string" && n.title.length > 48) W(`${at} title is long (${n.title.length}); labels get crowded on the canvas`);
  }

  const pair = new Set();
  let inferred = 0;
  for (const e of s.edges) {
    const at = `edge ${e?.source}→${e?.target}`;
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) { E(`${at} references a missing node`); continue; }
    if (e.source === e.target) E(`${at} is a self-loop`);
    if (typeof e.label !== "string" || !e.label.trim()) E(`${at} needs a label (say what the relationship IS)`);
    if (!KINDS.has(e.kind)) E(`${at} kind must be 'explicit' or 'inferred'`);
    if (e.kind === "inferred") inferred++;
    if (e.kind === "explicit" && (!Array.isArray(e.sources) || !e.sources.length)) E(`${at} is 'explicit' but cites no source; cite one or mark it 'inferred'`);
    for (const id of e.sources || []) if (!sourceIds.has(id)) E(`${at} cites unknown source '${id}'`);
    const key = [e.source, e.target].sort().join("|");
    if (pair.has(key)) W(`${at} duplicates another edge between the same nodes`);
    pair.add(key);
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }
  for (const [id, d] of degree) if (d === 0) W(`node '${id}' has no edges (orphan)`);
  if (s.edges.length && inferred / s.edges.length > 0.35 && inferred / s.edges.length <= 0.5) W(`${inferred}/${s.edges.length} edges are inferred (>35%); look for sources that make more of them explicit`);
  if (s.edges.length && inferred / s.edges.length > 0.5) W(`${inferred}/${s.edges.length} edges are inferred; the map is mostly interpretation. Find more sources.`);
  if (s.nodes.length < 8) W(`only ${s.nodes.length} nodes; a story usually needs 15-60`);
  if (s.nodes.length > 150) W(`${s.nodes.length} nodes will be hard to read; consider splitting into multiple stories`);

  if (nodeIds.has(s.root)) {
    const adj = new Map([...nodeIds].map((i) => [i, []]));
    for (const e of s.edges) if (adj.has(e.source) && adj.has(e.target)) { adj.get(e.source).push(e.target); adj.get(e.target).push(e.source); }
    const seen = new Set([s.root]), q = [s.root];
    while (q.length) for (const nb of adj.get(q.pop())) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
    const lost = [...nodeIds].filter((i) => !seen.has(i));
    if (lost.length) W(`${lost.length} node(s) are not connected to the root: ${lost.slice(0, 6).join(", ")}`);
  }

  let dated = 0;
  for (const n of s.nodes) {
    if (n.start === undefined && n.end === undefined) continue;
    const a = dateParts(n.start), b = n.end === undefined ? a : dateParts(n.end);
    if (a === null) E(`node '${n.id}' start must look like "1666-09-02", "1666-09", "1666" or "-0500" (negative = BCE); got ${JSON.stringify(n.start)}`);
    else if (b === null) E(`node '${n.id}' end must look like "1666-09-02", "1666-09", "1666" or "-0500"; got ${JSON.stringify(n.end)}`);
    else { dated++; if (b < a) E(`node '${n.id}' ends before it starts`); }
  }
  {
    const ts = s.nodes.flatMap((n) => [dateParts(n.start), n.end === undefined ? null : dateParts(n.end)]).filter((v) => v !== null).sort((a, b) => a - b);
    if (ts.length >= 8) {
      const q = (p) => ts[Math.min(ts.length - 1, Math.floor(p * (ts.length - 1)))];
      const core = q(0.9) - q(0.1), full = ts[ts.length - 1] - ts[0];
      if (core > 0 && full > core * 8) W(`a few outlier dates stretch the timeline (all dates span ${full.toFixed(1)} years but 80% fall within ${core.toFixed(1)}); keep far-off dates in 'when' only, or drop 'start'/'end' on those nodes`);
    }
  }
  if (dated > 0 && dated < 5) W(`only ${dated} node(s) have 'start'; the Timeline view needs at least 5 dated nodes, so it will be hidden`);
  if (s.views !== undefined && (!Array.isArray(s.views) || s.views.some((v) => !VIEWS.includes(v)))) E(`'views' must be an array drawn from ${VIEWS.join(", ")}`);
  if (s.defaultView !== undefined && !VIEWS.includes(s.defaultView)) E(`'defaultView' must be one of ${VIEWS.join(", ")}`);
  if (s.defaultView === "timeline" && dated < 5) W("'defaultView' is timeline but fewer than 5 nodes have dates; it will fall back to the graph");
  for (const st of s.stories || []) {
    if (typeof st.id !== "string" || typeof st.title !== "string") E("each story needs id and title");
    if (!Array.isArray(st.steps) || st.steps.length < 2) E(`story '${st.id}' needs 2+ steps`);
    else for (const id of st.steps) if (!nodeIds.has(id)) E(`story '${st.id}' step '${id}' is not a node`);
  }
  const adjacent = new Set(s.edges.flatMap((e) => [e.source + "|" + e.target, e.target + "|" + e.source]));
  for (const st of s.stories || []) {
    if (!Array.isArray(st.steps)) continue;
    const gaps = st.steps.slice(1).filter((id, i) => !adjacent.has(st.steps[i] + "|" + id)).length;
    if (gaps > st.steps.length / 2) W(`story '${st.id}': ${gaps} of ${st.steps.length - 1} transitions jump between nodes with no edge; add edges or reorder so the path follows real relationships`);
  }
  for (const n of s.nodes) if (typeof n.evidence === "string" && n.evidence.split(/s+/).length > 40) W(`node '${n.id}' evidence is ${n.evidence.split(/s+/).length} words; keep quotes short (~25) and paraphrase the rest`);
  if (!(s.stories || []).length) W("no 'stories' defined; guided paths are what make this a story rather than a diagram");
  for (const k of ["credit", "disclaimer"]) if (s[k] !== undefined && typeof s[k] !== "string") E(`'${k}' must be a string`);
  return { errors, warnings };
}

export function validateTheme(t, story) {
  const errors = [], warnings = [];
  const E = (m) => errors.push(m), W = (m) => warnings.push(m);
  if (!t || typeof t !== "object") return { errors: ["theme.json is not an object"], warnings };
  if (t.schemaVersion !== 1) E("theme schemaVersion must be 1");
  if (!["dark", "light"].includes(t.mode)) E("theme.mode must be 'dark' or 'light'");
  const c = t.colors || {};
  for (const k of ["bg", "text", "accent"]) if (!parseHex(c[k])) E(`theme.colors.${k} must be a #hex colour`);
  for (const k of ["surface", "muted"]) if (c[k] !== undefined && !parseHex(c[k])) E(`theme.colors.${k} must be a #hex colour`);
  if (errors.length) return { errors, warnings };

  const bg = parseHex(c.bg), text = parseHex(c.text), accent = parseHex(c.accent);
  const bgLum = luminance(bg);
  if (t.mode === "dark" && bgLum > 0.3) W("theme.mode is 'dark' but bg is light");
  if (t.mode === "light" && bgLum < 0.3) W("theme.mode is 'light' but bg is dark");
  const r = (a, b) => contrast(a, b).toFixed(2);
  if (contrast(text, bg) < 4.5) E(`text on bg contrast is ${r(text, bg)} (need 4.5). Adjust text or bg.`);
  if (c.muted && contrast(parseHex(c.muted), bg) < 4.5) W(`muted on bg contrast is ${r(parseHex(c.muted), bg)} (want 4.5 for small text)`);
  if (contrast(accent, bg) < 3) E(`accent on bg contrast is ${r(accent, bg)} (need 3). The brand colour disappears on this background: flip the background (dark<->light), or use a stronger tint of the brand colour as accent and keep the exact brand hex for the logo/root only.`);
  const clusterIds = new Set((story?.clusters || []).map((x) => x.id));
  for (const [id, col] of Object.entries(t.clusters || {})) {
    const p = parseHex(col);
    if (!p) { E(`theme.clusters.${id} must be a #hex colour`); continue; }
    if (story && !clusterIds.has(id)) W(`theme.clusters.${id} does not match any story cluster`);
    if (contrast(p, bg) < 3) W(`cluster '${id}' colour ${col} has low contrast (${r(p, bg)}) on bg`);
  }
  if (story) for (const id of clusterIds) if (!t.clusters?.[id]) W(`cluster '${id}' has no colour in theme; one will be derived from the accent`);
  if (t.font?.googleFonts && !/^https:\/\/fonts\.googleapis\.com\//.test(t.font.googleFonts)) E("font.googleFonts must be a https://fonts.googleapis.com/ URL");
  if (t.logo) {
    const src = t.logo.src || "";
    if (!/^(data:image\/(png|svg\+xml|webp|jpeg|gif);|https:\/\/)/.test(src)) E("logo.src must be a https URL or data:image/... URI");
  }
  const cl = Object.entries(t.clusters || {}).filter(([, c]) => parseHex(c));
  for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) {
    const [p, q] = [parseHex(cl[i][1]), parseHex(cl[j][1])];
    if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 40) W(`clusters '${cl[i][0]}' and '${cl[j][0]}' have near-identical colours; they will be indistinguishable as dots`);
  }
  if (!t.brandSources?.length) W("theme has no 'brandSources'; record where the colours/fonts came from so a human can check them");
  return { errors, warnings };
}
