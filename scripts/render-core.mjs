// Pure rendering: a validated story + theme + template text -> one self-contained HTML string.
// No Node APIs, so it also runs in a browser. scripts/render.mjs wraps it with the on-disk template.
import { isCssColour } from "./validate.mjs";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// JSON is embedded in a <script type="application/json"> block: neutralise "<" so "</script>" can never appear.
const BS = String.fromCharCode(92); // backslash, spelled out so nothing can "helpfully" unescape it
const uEsc = (ch) => BS + "u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
const json = (o) => [60, 0x2028, 0x2029].reduce((s, cp) => s.split(String.fromCharCode(cp)).join(uEsc(String.fromCharCode(cp))), JSON.stringify(o));

export function renderWithTemplate(story, theme, template) {
  const c = theme.colors;
  const rootCss = `:root{--bg:${c.bg};--surface:${c.surface || c.bg};--text:${c.text};--muted:${c.muted || c.text};--line:${isCssColour(c.line) ? c.line : "rgba(128,128,128,.25)"};--accent:${c.accent};color-scheme:${theme.mode}}`;
  const fontLinks = theme.font?.googleFonts
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(theme.font.googleFonts)}">`
    : "";
  const desc = `${story.tagline}${story.disclaimer ? " " + story.disclaimer : ""}`;
  let html = template;
  const fill = {
    TITLE: esc(`${story.title} · Story Graph`),
    DESCRIPTION: esc(desc),
    THEME_COLOR: esc(c.bg),
    ACCENT_HEX: c.accent.replace("#", ""),
    ROOT_CSS: rootCss,
    FONT_LINKS: fontLinks,
    NOSCRIPT: `<h1>${esc(story.title)}</h1><p>${esc(story.tagline)}</p><p>This interactive story graph needs JavaScript. The full content follows.</p><ul>${story.nodes.map((n) => `<li><strong>${esc(n.title)}</strong>: ${esc(n.summary)}</li>`).join("")}</ul>`,
    THEME_JSON: json(theme),
    STORY_JSON: json(story),
  };
  for (const [k, v] of Object.entries(fill)) html = html.split(`{{${k}}}`).join(v);
  return html;
}
