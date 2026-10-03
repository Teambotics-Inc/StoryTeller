// Code-enforced honesty checks: compare what the story CLAIMS to have read with what the agent's tools actually returned.
// Pure functions, no Node APIs (runs in a browser). This is a prototype: thresholds are meant to be tuned from real runs.

// Tolerant URL key: host (no www) + path (no trailing slash), ignoring scheme, query, fragment. Redirect and canonical
// differences will still cause misses; the prototype reports those so we can see how common they are.
export function urlKey(u) {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch { return String(u || "").toLowerCase(); }
}

const norm = (s) => String(s || "").toLowerCase().replace(/[‘’“”"'`]/g, "").replace(/[^\p{L}\p{N}%.$,\s-]/gu, " ").replace(/\s+/g, " ").trim();
const numbers = (s) => (String(s).match(/\d[\d,.]*\d|\d/g) || []).map((n) => n.replace(/[,.]+$/, ""));

// Records what the tools returned. Feed it every assistant message (server tool results live in its content).
export function createLedger() {
  const searched = new Map(); // key -> {url, title}
  const fetched = new Map();  // key -> {url, text}
  return {
    searched, fetched,
    ingest(content) {
      for (const b of content || []) {
        if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
          for (const r of b.content) if (r && r.url) searched.set(urlKey(r.url), { url: r.url, title: r.title || "" });
        } else if (b.type === "web_fetch_tool_result" && b.content && b.content.type !== "web_fetch_tool_error" && b.content.url) {
          const doc = b.content.content;
          const text = doc && doc.source && typeof doc.source.data === "string" ? doc.source.data : typeof doc === "string" ? doc : "";
          fetched.set(urlKey(b.content.url), { url: b.content.url, text });
        }
      }
    },
  };
}

// Returns {errors, warnings, stats}. Mutates nothing; the caller applies the clock-set `accessed` date.
export function checkProvenance(story, ledger, { today } = {}) {
  const errors = [], warnings = [];
  const stats = { sources: story.sources.length, fetched: 0, snippetOnly: 0, unseen: 0, evidenceTotal: 0, evidenceExact: 0, evidenceNumbersOk: 0, evidenceUnverifiable: 0 };
  const srcState = new Map();
  for (const s of story.sources) {
    const k = urlKey(s.url);
    if (ledger.fetched.has(k)) { stats.fetched++; srcState.set(s.id, "fetched"); }
    else if (ledger.searched.has(k)) { stats.snippetOnly++; srcState.set(s.id, "snippet"); warnings.push(`source '${s.id}' (${s.url}) was only seen as a search result, not fetched; do not rely on it for quotes or figures`); }
    else { stats.unseen++; srcState.set(s.id, "unseen"); errors.push(`source '${s.id}' (${s.url}) does not appear in any web_search or web_fetch result from this run. If you did not read it, do not cite it. Fetch it or remove it.`); }
  }
  for (const n of story.nodes) {
    if (!n.evidence) continue;
    stats.evidenceTotal++;
    const texts = (n.sources || []).filter((id) => srcState.get(id) === "fetched").map((id) => {
      const src = story.sources.find((s) => s.id === id);
      return ledger.fetched.get(urlKey(src.url)).text;
    }).filter(Boolean);
    if (!texts.length) { stats.evidenceUnverifiable++; continue; }
    const hay = texts.map(norm).join(" \n ");
    const ev = norm(n.evidence);
    if (ev && hay.includes(ev)) { stats.evidenceExact++; stats.evidenceNumbersOk++; continue; }
    const nums = numbers(n.evidence);
    const numsOk = nums.every((x) => hay.includes(x.toLowerCase()));
    if (numsOk && nums.length) stats.evidenceNumbersOk++;
    if (nums.length && !numsOk) warnings.push(`node '${n.id}': figures in evidence (${nums.join(", ")}) are not all present in the fetched text of its cited sources`);
    else if (!nums.length && ev.length > 40) warnings.push(`node '${n.id}': evidence is not found verbatim in the fetched text of its cited sources; quote exactly or label it as a paraphrase`);
  }
  if (today && story.generated && story.generated.date !== today) warnings.push(`generated.date was set to ${today} by the page`);
  return { errors, warnings, stats };
}
