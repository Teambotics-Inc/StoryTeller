#!/usr/bin/env node
// Usage: node scripts/brand-probe.mjs <https://site> [--json]
// Fetches a site's homepage + up to 6 stylesheets and reports the evidence you need to build theme.json:
// theme-color, CSS custom properties, the most-used colours (ranked), font families, icons/logo candidates.
// It reports evidence; YOU choose the palette (see playbook/4-brand.md). Zero dependencies, Node 18+.
// Limits: JavaScript-rendered sites may expose little CSS. Use the in-browser snippet in the playbook then.

const url = process.argv[2];
const asJson = process.argv.includes("--json");
if (!url || !/^https?:\/\//i.test(url)) { console.error("usage: node scripts/brand-probe.mjs https://example.com [--json]"); process.exit(2); }

const UA = "Mozilla/5.0 (compatible; StoryTellerBrandProbe/1.0)";
async function get(u, max = 1_500_000) {
  const r = await fetch(u, { headers: { "user-agent": UA, accept: "text/html,text/css,*/*" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return { text: (await r.text()).slice(0, max), url: r.url };
}
const abs = (href, base) => { try { return new URL(href, base).href; } catch { return null; } };

const toHex = (c) => {
  c = c.trim().toLowerCase();
  let m;
  if ((m = /^#([0-9a-f]{3})$/.exec(c))) return "#" + [...m[1]].map((x) => x + x).join("");
  if ((m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(c))) return "#" + m[1];
  if ((m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(c))) return "#" + [m[1], m[2], m[3]].map((n) => Math.min(255, +n).toString(16).padStart(2, "0")).join("");
  return null;
};
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = rgb(h); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const sat = (h) => { const [r, g, b] = rgb(h).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const page = await get(url);
const html = page.text;
const meta = (name) => { const m = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, "i").exec(html); return m ? (m[1] || m[2]) : null; };

const sheets = [...html.matchAll(/<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi)].map((m) => /href=["']([^"']+)["']/i.exec(m[0])?.[1]).filter(Boolean).map((h) => abs(h, page.url)).filter(Boolean);
const googleFonts = sheets.filter((s) => s.includes("fonts.googleapis.com"));
const cssUrls = sheets.filter((s) => !s.includes("fonts.googleapis.com")).slice(0, 6);
const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
let css = inline;
const fetched = [];
for (const u of cssUrls) { try { const r = await get(u); css += "\n" + r.text; fetched.push(u); } catch (e) { fetched.push(`${u} (failed: ${e.message})`); } }

// Also pull Google Fonts family names from link hrefs (they carry the brand's webfont choice).
const gfFamilies = googleFonts.flatMap((g) => [...g.matchAll(/family=([^&:]+)/g)].map((m) => decodeURIComponent(m[1]).replace(/\+/g, " ")));

const vars = {};
for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}{]+)[;}]/g)) { const hex = toHex(m[2].trim()); if (hex && !(m[1] in vars)) vars[m[1]] = hex; }

const counts = new Map();
for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d+[\s,]+\d+[\s,]+\d+[^)]*\)/g)) { const h = toHex(m[0]); if (h) counts.set(h, (counts.get(h) || 0) + 1); }
const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([hex, n]) => ({ hex, uses: n, lightness: +lum(hex).toFixed(3), saturation: +sat(hex).toFixed(2) }));
const accentCandidates = ranked.filter((c) => c.saturation > 0.45 && c.lightness > 0.05 && c.lightness < 0.85).slice(0, 5);
const neutrals = ranked.filter((c) => c.saturation < 0.15);
const darkBg = neutrals.filter((c) => c.lightness < 0.06).slice(0, 3);
const lightBg = neutrals.filter((c) => c.lightness > 0.85).slice(0, 3);

const fonts = new Map();
const NOT_FONT = /^(inherit|initial|unset|none|cover|contain|normal|var\(|inherit)/i;
for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)[;}]/gi)) { const v = m[1].trim().replace(/\s*!important/, ""); if (NOT_FONT.test(v) || !/[a-z]{3}/i.test(v)) continue; fonts.set(v, (fonts.get(v) || 0) + 1); }
const fontFaces = [...css.matchAll(/@font-face\s*{[^}]*font-family\s*:\s*["']?([^;"'}]+)/gi)].map((m) => m[1].trim());

const icons = [...html.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi)].map((m) => abs(/href=["']([^"']+)["']/i.exec(m[0])?.[1], page.url)).filter(Boolean);
const logoImgs = [...html.matchAll(/<img[^>]+(?:class|id|alt|src)=["'][^"']*logo[^"']*["'][^>]*>/gi)].map((m) => abs(/src=["']([^"']+)["']/i.exec(m[0])?.[1], page.url)).filter(Boolean).slice(0, 4);

const out = {
  url: page.url, title: /<title[^>]*>([^<]*)/i.exec(html)?.[1]?.trim() || null,
  themeColor: meta("theme-color"), ogImage: meta("og:image"), ogSiteName: meta("og:site_name"),
  stylesheetsRead: fetched, cssBytes: css.length,
  cssVariables: vars, topColors: ranked, accentCandidates, darkBackgroundCandidates: darkBg, lightBackgroundCandidates: lightBg,
  fontFamiliesByUse: [...fonts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, n]) => ({ family: f, uses: n })),
  fontFaces: [...new Set(fontFaces)].slice(0, 8), googleFontFamilies: gfFamilies, googleFontsUrl: googleFonts[0] || null,
  icons, logoImageCandidates: logoImgs,
  notes: [],
};
if (new URL(page.url).hostname.replace(/^www\./, "") !== new URL(url).hostname.replace(/^www\./, "")) out.notes.push(`Redirected to ${page.url} (regional or different domain). Colours below describe THAT site; check it is the one you want, and confirm the brand against a screenshot.`);
if (!logoImgs.length) out.notes.push("No <img> logo found (logos are often inline SVG or CSS backgrounds). Check the page visually.");
out.notes.push("Frequency is not identity: the most-used saturated colour is often a UI state or a seasonal banner. Confirm the signature colour against a screenshot of the hero, buttons and logo.");
if (css.length < 2000) out.notes.push("Very little CSS found: the site is probably JavaScript-rendered. Open it in a browser tool and run the computed-style snippet in playbook/4-brand.md.");
if (!ranked.length) out.notes.push("No colours found in fetched CSS.");

if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
const row = (c) => `  ${c.hex}  ×${String(c.uses).padEnd(4)} sat ${c.saturation}  lightness ${c.lightness}`;
console.log(`Brand probe: ${out.title || out.url}\n  ${out.url}`);
console.log(`\ntheme-color: ${out.themeColor || "(none)"}   og:site_name: ${out.ogSiteName || "(none)"}   og:image: ${out.ogImage || "(none)"}`);
console.log(`\nCSS read: ${fetched.length} stylesheet(s) + inline, ${(css.length / 1024).toFixed(0)} KB`);
console.log(`\nCSS custom properties with colour values (${Object.keys(vars).length}):`);
for (const [k, v] of Object.entries(vars).slice(0, 30)) console.log(`  ${k}: ${v}`);
console.log(`\nMost-used colours:`); ranked.slice(0, 14).forEach((c) => console.log(row(c)));
console.log(`\nAccent candidates (saturated, frequently used):`); accentCandidates.forEach((c) => console.log(row(c)));
console.log(`\nBackground candidates: dark ${darkBg.map((c) => c.hex).join(", ") || "-"}  |  light ${lightBg.map((c) => c.hex).join(", ") || "-"}`);
console.log(`\nFonts (by use):`); out.fontFamiliesByUse.forEach((f) => console.log(`  ×${f.uses}  ${f.family}`));
if (out.fontFaces.length) console.log(`@font-face: ${out.fontFaces.join(", ")}`);
if (out.googleFontsUrl) console.log(`Google Fonts: ${out.googleFontFamilies.join(", ")}\n  ${out.googleFontsUrl}`);
console.log(`\nIcons: ${icons.slice(0, 4).join("  ") || "(none)"}\nLogo <img> candidates: ${logoImgs.join("  ") || "(none)"}`);
for (const n of out.notes) console.log(`\n! ${n}`);
console.log("\nNext: pick bg/text/accent from THIS evidence, then run the build; it checks contrast. Record what you used in theme.brandSources.");
