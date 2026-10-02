# Changelog

## Unreleased

- Standalone stories get a Full screen button (and the F key). It is hidden where the browser cannot do full screen and when the story is embedded in another page, which supplies its own button. All examples rebuilt.
- Design sketch for optional public, no-account publishing: `scripts/publish.mjs` (dry run unless `--yes`; create, update, delete with a saved edit token), a reference service in `services/publish/` (server-side render, validation, size limits, rate limit, policy hook, noindex and no-network CSP), `docs/publishing.md`, and `playbook/6-publish.md`. Nothing is deployed and no service URL is built in. Rendering moved into `scripts/render.mjs` (output unchanged).
- Repository moved to the Teambotics-Inc organisation (old links redirect).
- Two brand-matched company studies added as examples (their colours extracted from each company's own site, with provenance in `brandSources`).
- Featured order of examples on the site is data (`site/order.json`), not code.
- Featured stories on the landing page: a picker and an embedded viewer with view switching and a full-screen button; every story also gets its own page (`/stories/<slug>/`) with about, guided stories and sources, plus a standalone full page. Optional git-ignored `site/showcase/` for deployer-only stories.
- Product page (`site/`, built by `scripts/build-site.mjs`): every example is served as a live page, with example statistics generated from the real data.
- `vercel.json` for static hosting with security headers.
- New example: the Rosetta Stone (a historical object): independent sources for contested claims, Wikipedia-only details attributed, and open disagreements shown side by side.

## 1.0.0

First public release.

- Agent-first workflow: `AGENTS.md` and a five-step playbook (scope, research, model, brand, build and verify), plus advice per subject kind.
- One self-contained HTML output with five views of the same sourced data: graph, zoomable timeline, read-through narrative, outline, list. Guided stories, search, filters, deep links (`#node=`, `#story=`, `#view=`), keyboard and touch support.
- Zero-dependency tooling: `build.mjs` (validate and build), `validate.mjs` (provenance, structure, dates, contrast), `brand-probe.mjs` (extract real colours and fonts from a site), `fetch-text.mjs` (read a page as text).
- Two worked examples: a word's etymology (light theme) and a historical event (dark theme, day-level timeline).
- Test suite (`node --test tests/toolkit.test.mjs`) and CI on Node 18, 20 and 22.
