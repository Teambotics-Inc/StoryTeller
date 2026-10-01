# Changelog

## 1.0.0

First public release.

- Agent-first workflow: `AGENTS.md` and a five-step playbook (scope, research, model, brand, build and verify), plus advice per subject kind.
- One self-contained HTML output with five views of the same sourced data: graph, zoomable timeline, read-through narrative, outline, list. Guided stories, search, filters, deep links (`#node=`, `#story=`, `#view=`), keyboard and touch support.
- Zero-dependency tooling: `build.mjs` (validate and build), `validate.mjs` (provenance, structure, dates, contrast), `brand-probe.mjs` (extract real colours and fonts from a site), `fetch-text.mjs` (read a page as text).
- Two worked examples: a word's etymology (light theme) and a historical event (dark theme, day-level timeline).
- Test suite (`node --test tests/toolkit.test.mjs`) and CI on Node 18, 20 and 22.
