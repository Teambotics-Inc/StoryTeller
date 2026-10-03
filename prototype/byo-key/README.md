# Bring-your-own-key generator: prototype

Prototype for [issue #13](https://github.com/Teambotics-Inc/StoryTeller/issues/13); design in [`docs/byo-key-generator.md`](../../docs/byo-key-generator.md). Not part of the toolkit or the site build. It lives in its own folder with its own `package.json` so the toolkit stays dependency-free.

**Status: live at `/byo/` on the product site, and one real run has worked end to end from the deployed page.** The loop is also tested against a scripted fake API client. One run is not a measurement: cost, time and quality across subject kinds, models and effort levels are still mostly unmeasured (see "First real run" and "Still unverified").

## What is here

| File | What it does |
|---|---|
| `agent.mjs` | Browser-safe agent loop. Injected `client`; append-only conversation; server-side `web_search` and `web_fetch`; a `submit_story` tool whose result carries validator errors and warnings back to the model; spend cap; cancel; refusal, `pause_turn` and `max_tokens` handling; key scrubbed from errors. |
| `provenance.mjs` | Code-enforced honesty: every cited source must appear in a `web_search`/`web_fetch` result of this run (a miss is an error, a search-only source a warning); evidence is checked against the fetched text (verbatim, or at least its figures). |
| `prompt.mjs` | System prompt built from `AGENTS.md`, the playbook, the schemas and the default theme at run time, so it cannot drift from the repo. |
| `web/` | The page: key, subject, options, live log, cost counter, result with download and sandboxed preview. |
| `run.mjs`, `eval.mjs`, `subjects.json` | Headless runs against the real API for measurement (company, event, word, place). |
| `build.mjs`, `serve.mjs`, `assets.mjs` | Generates the page's copy of the repo text; a tiny static server. |

Also changed in the toolkit: the pure rendering code moved to `scripts/render-core.mjs` (no Node APIs) so a browser can render; `scripts/render.mjs` wraps it. Output is byte-identical (tested).

## Try the page

```bash
cd prototype/byo-key && npm install
node build.mjs && node serve.mjs 8788
# open http://localhost:8788/prototype/byo-key/web/
```

The SDK is vendored in `web/vendor/` (see its README), so the page loads no third-party scripts.

## Measure it (spends real money)

```bash
export ANTHROPIC_API_KEY=...            # use a key with a spend limit
cd prototype/byo-key
node run.mjs "The Great Fire of London, 1666" --dry-run        # prints the request, sends nothing
node run.mjs "The Great Fire of London, 1666" --max-usd 5 --yes
node eval.mjs --max-usd 5 --yes         # all four subjects; worst case 4 x cap, before search fees
```

Each run writes `runs/<name>/` with `story.json`, `theme.json`, `index.html` and `metrics.json` (cost, time, turns, searches, fetches, submission rounds, source-fetched rate, evidence-verbatim rate). `eval.mjs` also writes `runs/eval-*/summary.md`. The cost counter uses token prices only; per-search fees are not modelled, so check the pricing page before quoting totals.

## First real run

One run on the deployed page (2026-10-03), entered through the web form with the user's own key. It used the cheaper model at low effort, so it shows the floor, not the typical case.

| | |
|---|---|
| Subject | Coca-Cola (a company), no start page |
| Model, effort, cap | `claude-sonnet-5-5`, low, $1.00 |
| Outcome | done: first submission accepted (0 errors, 8 warnings) |
| Estimated cost | $0.30 (token prices only; search fees are not included) |
| Time | 90 s |
| Turns / searches / fetches | 2 / 2 / 2 |
| Sources fetched | 2 of 2 cited sources had been fetched |
| Evidence verbatim | 9 of 10 checkable nodes matched the fetched text |
| Story | 30 nodes, 35 edges (20 inferred), 7 clusters, 3 guided stories, timeline on |

What it showed:

- **It works.** Browser access from our origin, the request shape (including the fallback option), the SDK vendored into the page, and the page's CSP are all confirmed by this run.
- **The source ledger reads real results.** The page found the fetched text of both pages in the real `web_fetch` results and used it for the evidence check (9/10), so that block shape is confirmed. No false "not fetched" errors occurred, but with only two plain URLs this says little about redirects.
- **The story was thin.** Two sources, where the playbook asks for 10 to 25: one reference article and the company's own history page. The agent itself said so in its summary and listed what it did not cover (the formula, criticism, bottler structure, financials). The validator warned that 20 of 35 edges were inferred ("find more sources").
- **Warnings did not force improvement.** The first valid submission was accepted, and the agent chose not to resubmit although eight warnings remained, including seven cluster colours missing from the theme. The accepted-with-warnings note was only a suggestion.
- **Brand:** it did not guess the brand colours (it used the neutral dark theme and said so), as the prompt requires, but the result does not look like the subject's own site.
- **Cost:** $0.30 is for a two-source story at low effort on the cheaper model. A 10 to 25 source story at higher effort will cost more; that is the next thing to measure.

### Follow-ups this suggests

- **Done (untested against the real API):** very few sources is now an error that sends the agent back to research. The floors (`limits.mjs`) are fetched and cited sources: 8 for a company, brand, person, place or product; 6 for an event, history or idea; 4 for a word; 6 otherwise. A thin draft is bounced up to twice, then accepted with a "story is thin" warning so a subject with little to read cannot loop forever. The prompt states the floors up front.
- **Done (untested against the real API):** a theme missing a colour for any cluster is now an error that lists the cluster ids (it was a validator warning the agent ignored).
- Re-run the same subject at higher effort and on `claude-opus-5-5`, and run the other subject kinds with `eval.mjs`, to see how cost and source counts change.
- Find out the per-search fees, so the cost counter can include them.

## Still unverified

Confirmed by the first run: the request shape on `claude-sonnet-5-5`, browser access with `dangerouslyAllowBrowser` from the deployed origin, and the shape of `web_fetch` results that `provenance.mjs` reads. The test fixtures in `tests/byo-agent.test.mjs` still follow the documented shape, not a captured real response; capture one and add it.

Still to check:

- The same request shape on `claude-opus-5-5` (the default), at higher effort, and with `fallbacks` on that model.
- The shape of `web_search_tool_result` blocks (only fetched pages mattered in the first run).
- Redirects and canonical URLs may make `urlKey` miss legitimate sources (false "not fetched" errors); this run had none, with only two plain URLs.
- Cost and time for a normal-sized story, per-search fees, and behaviour on the other subject kinds (event, word, place).
- Any Anthropic guidance on browser-side keys.

## Findings so far (from building it)

- A strict CSP on the page is inherited by the `srcdoc` preview of the generated story, whose inline script would then not run. The deployed page solves this by allowing only the story template's inline script by hash (computed at site build) and keeping connections limited to the API; a separate origin for the preview remains an option for stricter hosting.
- `submit_story` is deliberately not `strict`: the story schema is large and loose, and our own validator already returns precise errors. Forced `tool_choice` is rejected by the chosen model, so the prompt tells it when to call the tool.
- The loop never edits earlier messages (needed for thinking blocks to stay valid) and only appends nudges and tool results.
