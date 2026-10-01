# 4. Brand and theme

Goal: `theme.json` that makes the story look like it belongs to its subject, *derived from evidence*, never from memory. Schema: [`../schema/theme.schema.json`](../schema/theme.schema.json). Example of a non-brand palette with its reasoning recorded: [`../examples/salary/theme.json`](../examples/salary/theme.json). An illustrative brand theme (fictional) follows below.

## Decide: brand or not?

| Subject | Theme approach |
|---|---|
| Company, product, organisation, institution, publication | **Extract from their own site** (below). |
| Person with a strong public identity (studio, artist, author with a site) | Extract from *their* site if they have one. |
| Private person, relationship, family | Neutral or warm palette you choose deliberately. Never borrow another brand's look. |
| Place, event, era, word, idea | A considered palette that evokes it (a map's ochres and sea-blues, parchment for etymology, the era's print colours). Justify it in `brandSources`. |
| Brand exists but the user asked for something different | Follow the user. |

If there's no brand, start from `template/default-theme.json` and change it on purpose. Don't ship the neutral default for a subject that has a face.

## Extract (brands)

1. **Probe the site**:

   ```bash
   node scripts/brand-probe.mjs https://www.example.com
   ```

   It reports `theme-color`, CSS custom properties, the most-used colours ranked with saturation/lightness, accent and background candidates, font families, Google-Fonts links, and icon/logo candidates.

2. **If the site is JavaScript-rendered** (probe says little CSS), load it in a browser tool and run this in the page:

   ```js
   (() => {
     const tally = (prop) => { const m = {}; document.querySelectorAll("body *").forEach(e => { const v = getComputedStyle(e)[prop]; if (v && v !== "rgba(0, 0, 0, 0)") m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8); };
     const root = getComputedStyle(document.documentElement);
     const vars = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } })
       .flatMap(r => r.style ? [...r.style].filter(n => n.startsWith("--")).map(n => [n, r.style.getPropertyValue(n).trim()]) : []).slice(0, 60);
     return { bodyBg: getComputedStyle(document.body).backgroundColor, bodyColor: getComputedStyle(document.body).color, bodyFont: getComputedStyle(document.body).fontFamily,
              h1Font: getComputedStyle(document.querySelector("h1") || document.body).fontFamily,
              backgrounds: tally("backgroundColor"), textColors: tally("color"), borders: tally("borderTopColor"), links: [...document.querySelectorAll("a,button")].slice(0, 40).map(e => getComputedStyle(e).backgroundColor), vars };
   })()
   ```

   Also look at the page yourself (screenshot): the hero, buttons, and logo show which colour the brand *leads* with. Numbers tell you what's frequent; the eye tells you what's signature.

3. **Choose the roles** from the evidence:

   - **`accent`**: the brand's signature colour (the one on primary buttons, logo, hero highlights). Copy the exact hex.
   - **`bg` / `mode`**: match the site's dominant canvas (dark site → `mode: "dark"`, else `light`). If the signature colour would fail contrast on that canvas (say pale yellow on white), flip the canvas (a dark background makes yellow glow) rather than darkening the brand colour until it's unrecognisable. The build errors when accent-on-bg contrast is under 3:1 and tells you what to do.
   - **`text` / `muted`**: from the site's own text colours (often off-white `#f5f2ea`-ish on dark, near-black on light), not pure `#fff`/`#000` unless the site uses them. `text` ≥ 4.5:1 on `bg`, `muted` ≥ 4.5:1.
   - **`surface`**: slightly lifted from `bg` (panel background).
   - **`clusters`**: one colour per cluster. Build them as **tints and neighbours of the palette**, not a rainbow: the accent for the most important cluster, then 4-8 related tones (warmer/cooler/lighter/darker, plus any secondary brand colours you found) that stay distinguishable at small dot size and ≥3:1 against `bg`. Omit a cluster and one is derived from the accent's hue.

   **Brands without one signature colour** (black-and-white identities, seasonal campaigns, multi-colour logos): don't grab the most frequent saturated colour, which is often a UI state or a banner. Look at the logo, the primary button and the hero. If the identity is essentially monochrome, use a restrained accent (a deep tone from the site's own imagery or link colour), keep `bg`/`text` true to the brand, and say in `brandSources` that the accent is a judgement call and why.

4. **Fonts**: prefer the brand's body font only if it is (a) a system font, or (b) on Google Fonts (set `font.googleFonts` to the `https://fonts.googleapis.com/css2?...` URL). Otherwise use the closest system stack and say so in `brandSources`. Always end stacks with system fallbacks. Proprietary face? Map by character: geometric sans → `system-ui, 'Segoe UI', Roboto, Arial, sans-serif`; humanist sans → `'Gill Sans', 'Trebuchet MS', Calibri, sans-serif`; serif wordmark → `Georgia, 'Times New Roman', serif`; condensed/industrial → `'Arial Narrow', 'Helvetica Neue', Arial, sans-serif`. Say you approximated. The page must read well with no webfont at all.

5. **Wordmark**: set `wordmark.text` (and `letterSpacing` / `uppercase`) to echo how the brand writes its name. Optionally `logo.src`: an `https` URL or small `data:image/svg+xml` / `png` URI of the brand's own logo. Only include a logo when the story is an honest independent study or made with the subject's consent, and keep the `disclaimer`.

6. **Record provenance** in `brandSources`: for each of accent / bg / font, *where* it came from (URL, token name, probe output) and any judgment call. A human reviewer will check this.

## Illustrative brand theme (fictional)

What a finished brand theme looks like for an invented company, with the provenance a reviewer expects in `brandSources`. (Every value here is made up; yours must come from the real subject's own evidence.)

```json
{
  "schemaVersion": 1,
  "name": "Example Co",
  "mode": "dark",
  "colors": { "bg": "#0b0c10", "surface": "#13151b", "text": "#f2efe8", "muted": "#a8a59c", "line": "rgba(242,239,232,0.16)", "accent": "#ff6a3d" },
  "clusters": { "origins": "#ff6a3d", "product": "#ffb703", "people": "#8ecae6", "results": "#b8f2c0" },
  "font": { "body": "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" },
  "wordmark": { "text": "EXAMPLE CO", "letterSpacing": "0.2em" },
  "brandSources": [
    { "what": "accent #ff6a3d", "from": "https://www.example.com/ via scripts/brand-probe.mjs", "note": "Primary button and logo colour; also --brand-accent in the site CSS." },
    { "what": "bg / mode dark", "from": "https://www.example.com/", "note": "Site is dark; accent contrast on bg is about 7:1." },
    { "what": "font", "from": "https://www.example.com/", "note": "Site uses a proprietary face; approximated with a system sans stack." }
  ]
}
```

## Non-brand palettes

Choose deliberately and write the reasoning down. Some starting points (all pass the contrast checks; adjust to taste):

| Feel | mode | bg | text | accent |
|---|---|---|---|---|
| Archive / etymology / history | light | `#f4efe6` | `#2a2520` | `#9b3d2a` |
| Geography / maps | light | `#eef1ee` | `#1f2a2a` | `#1f6f8b` |
| Relationship / personal | dark | `#14100f` | `#f3e9e2` | `#e8946b` |
| Science / ideas | dark | `#0c0d10` | `#eceae4` | `#7cc4ff` |

For light themes, set `line` to something like `rgba(0,0,0,0.16)`. Pick cluster colours with enough separation and ≥3:1 on the background (darker tones on light).

## Verify

`node scripts/build.mjs <dir>` validates contrast and cluster colours. Then look at the page next to the subject's own site (for a brand): does it feel like the same family? Is the signature colour recognisable? Can you read every label?
