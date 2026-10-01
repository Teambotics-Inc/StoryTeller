# 5. Build and verify

## Build

```bash
node scripts/build.mjs stories/<slug>           # validate + write stories/<slug>/index.html
node scripts/build.mjs stories/<slug> --check   # validate only (fast loop while editing JSON)
node scripts/build.mjs stories/<slug> --out ./out/index.html
```

Node 18+, no installs. The output is **one file**: CSS, JS, data, and theme are inlined. The only optional network request is the Google Font you may have named in the theme.

- **Errors** block the build. Fix them: they are real (missing source, dangling edge, unreadable contrast).
- **Warnings** are quality signals. Read each one. Fix it, or accept it on purpose and mention it to the user (e.g. "4 inferred edges bridge the two clusters").

No Node available? The renderer is just `template/story.html` with eight placeholders (`{{TITLE}}`, `{{DESCRIPTION}}`, `{{THEME_COLOR}}`, `{{ROOT_CSS}}`, `{{FONT_LINKS}}`, `{{NOSCRIPT}}`, `{{THEME_JSON}}`, `{{STORY_JSON}}`). Read `scripts/build.mjs` and do the same substitution by hand: HTML-escape the text ones, and in the two JSON blobs replace every `<` with the six characters backslash-u-0-0-3-c so no `</script>` can appear. Validate the rules in `scripts/validate.mjs` mentally before you ship.

## Verify in a browser (do this, don't assume)

Open the built `index.html` and check. `file://` works, or serve the folder (`python -m http.server 4173 --directory stories/<slug>`, then http://localhost:4173). Deep links: `index.html#node=<id>` and `#story=<id>`.

Some browser tools crop screenshots at emulated sizes; if so, also verify through DOM queries (panel open, `scrollWidth` equals the viewport width). Do all of these checks:

**Desktop (~1440×900)**
- [ ] The graph fills the stage; root is at the centre and visually dominant; no labels overlapping badly.
- [ ] Click 3 different nodes: panel opens with summary, evidence, connections, **sources that open the right URLs**.
- [ ] Filter chips and search dim the right nodes; "Explore as list" lists everything grouped by cluster.
- [ ] Each guided story steps through and the path/numbers follow the argument. Arrow keys step.
- [ ] Zoom, pan, drag a node; **Fit** and **Reset** recover.
- [ ] Every view in the switcher works: **Timeline** (zoom with the wheel, drag to pan, "Even spacing" toggle, ticks sensible), **Read** (each story reads as a coherent narrative), **Outline** (expand/collapse), **List**. Deep links: `#view=timeline`, `#view=read`.
- [ ] Console has no errors.

**Mobile (~375×812)**
- [ ] Header and filter rows don't swallow the screen (chip rows scroll sideways); the graph is usable; the detail panel is a bottom sheet; pinch-zoom works.

**Brand**
- [ ] Side by side with the subject's real site: same family of colour, recognisable accent, readable text. Brand names spelled as the brand spells them.

**Content**
- [ ] Open 5 random nodes and re-check their facts against the source text. Fix any drift.
- [ ] Nothing in the page asserts more than the sources support; inferred links look inferred.

Fix and rebuild until the list passes. If you cannot run a browser, state exactly which checks you skipped.

## Deliver

1. Leave the folder `stories/<slug>/` with `research.md`, `story.json`, `theme.json`, `index.html`.
2. Tell the user (short): the path; counts (nodes/edges/sources/stories); how many edges are inferred; brand decisions and their sources; what the sources did *not* cover; and any claim you'd want a human to double-check.
3. Hosting: it's one static file. Drop `index.html` on any static host (Vercel, Netlify, GitHub Pages, S3, a folder on their own site) or just email it. `#node=<id>` and `#story=<id>` in the URL deep-link to a node or a guided story.

Do not publish or push anything on the user's behalf unless they ask you to.
