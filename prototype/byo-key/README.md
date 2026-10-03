# Bring-your-own-key generator: prototype

Prototype for [issue #13](https://github.com/Teambotics-Inc/StoryTeller/issues/13); design in [`docs/byo-key-generator.md`](../../docs/byo-key-generator.md). Not part of the toolkit or the site build. It lives in its own folder with its own `package.json` so the toolkit stays dependency-free.

**Status: the loop is built and tested against a scripted fake API client. It has not yet been run against the real API**, so cost, time and quality numbers are still unmeasured. That is the next step and it needs an API key and a spending decision.

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

The page loads the SDK from esm.sh. That is for the prototype only: a real build must vendor it (no third-party scripts near an API key).

## Measure it (spends real money)

```bash
export ANTHROPIC_API_KEY=...            # use a key with a spend limit
cd prototype/byo-key
node run.mjs "The Great Fire of London, 1666" --dry-run        # prints the request, sends nothing
node run.mjs "The Great Fire of London, 1666" --max-usd 5 --yes
node eval.mjs --max-usd 5 --yes         # all four subjects; worst case 4 x cap, before search fees
```

Each run writes `runs/<name>/` with `story.json`, `theme.json`, `index.html` and `metrics.json` (cost, time, turns, searches, fetches, submission rounds, source-fetched rate, evidence-verbatim rate). `eval.mjs` also writes `runs/eval-*/summary.md`. The cost counter uses token prices only; per-search fees are not modelled, so check the pricing page before quoting totals.

## Unverified assumptions (confirm on the first real run)

- The request shape: `client.beta.messages.stream` with the server-side fallback beta and `fallbacks: "default"`, top-level `cache_control`, `output_config.effort`, `web_search_20260209` / `web_fetch_20260209`. If the API rejects any of it, `--no-fallbacks` is the first thing to try.
- The shapes of `web_search_tool_result` and `web_fetch_tool_result` blocks that `provenance.mjs` reads (fixtures in `tests/byo-agent.test.mjs` follow the documented shape, not a captured real response). Capture a real one and add it as a fixture.
- `dangerouslyAllowBrowser` as the SDK's browser opt-in, and any Anthropic guidance on browser-side keys.
- Redirects and canonical URLs may make `urlKey` miss legitimate sources (false "not fetched" errors). The first runs will show how often.

## Findings so far (from building it)

- A strict CSP on the page (`script-src 'self'`) would also be inherited by a `blob:`/`srcdoc` preview of the generated story, whose inline script then would not run. A hardened version needs the preview in a separate origin, or download only.
- `submit_story` is deliberately not `strict`: the story schema is large and loose, and our own validator already returns precise errors. Forced `tool_choice` is rejected by the chosen model, so the prompt tells it when to call the tool.
- The loop never edits earlier messages (needed for thinking blocks to stay valid) and only appends nudges and tool results.
