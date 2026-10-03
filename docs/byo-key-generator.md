# A bring-your-own-key story generator (design proposal)

Status: proposal. Nothing is built. Related: the hosted publishing sketch in [`publishing.md`](publishing.md), which is parked because the project does not want to operate a hosting platform.

## Idea in one paragraph

A static web page where someone enters a subject and their **own Anthropic API key**, watches an agent research and model the story, and gets the finished single-file `index.html` back (to download or host themselves). The agent loop runs in the browser and calls Anthropic directly, so the project runs no backend and pays for no inference. Listing a story on the public site is a separate, optional, human-reviewed step done through a pull request, not instant hosting.

## Goals and non-goals

Goals
- People who don't use a coding agent can make a sourced story.
- Zero running cost for the project: static hosting only.
- The user's key never reaches any server of ours.
- Keep the project's honesty rules, and enforce more of them in code.

Non-goals
- Hosting user stories (see `publishing.md` and the paused issues).
- An account system, a database, or any server component.
- Replacing the agent route (`AGENTS.md` + a coding agent), which stays the highest-fidelity path.

## Shape

```
browser page (static)
  ├─ UI: subject, optional start URL, key, budget, progress, result
  ├─ agent loop ── Messages API (direct from browser, user's key)
  │                 tools: web_search, web_fetch (run on Anthropic's side)
  │                        submit_story (our schema; strict tool)
  ├─ validate.mjs (unchanged, pure JS)  ── feedback to the agent on errors
  ├─ render (template inlined)          ── index.html
  └─ result: download, or "submit to the gallery" (optional PR)
```

## Key handling

- Memory only by default; an explicit "remember on this device" checkbox may use `localStorage`. Never put the key in a URL, a log, an error report or any request to a host other than the API.
- No third-party scripts, strict CSP (`connect-src` limited to the API origin), no analytics. Self-host any font, or use system fonts.
- Tell users to use a key with a spend limit, and to revoke it afterwards if they like. Say plainly that the page is open source and what it sends where.
- Browser calls need the SDK's explicit browser opt-in. Confirm the current mechanism and any Anthropic guidance on browser-side keys before building (not verified here).

## The agent loop

Each step of the playbook maps to a phase with its own prompt:
1. **Scope.** Turn the subject into a one-paragraph brief. Ask the user at most the playbook's three questions, in the UI.
2. **Research.** `web_search` and `web_fetch`, aiming for the playbook's 10-25 sources. Note that web fetch only fetches URLs already in the conversation, so URLs come from search results or the user's start URL.
3. **Model.** Produce `story.json` through a `submit_story` tool with a strict schema.
4. **Brand.** See "Brand" below.
5. **Build.** Run the validator in the page; return errors and warnings to the agent and loop until it passes or a retry cap is hit.

Model notes (to confirm against current docs when building): the default is `claude-opus-5-5`; thinking is always on, so control depth with `output_config.effort`; forced `tool_choice` is rejected, so use `auto` with a strict tool and an instruction; stream long responses; handle `stop_reason: "refusal"` and opt in to the server-side `fallbacks` parameter; use context editing or compaction for long runs; consider task budgets (beta) as a pacing aid alongside our own hard cap.

### Code-enforced honesty (new, and the main quality win)

Because the page sees every tool result, it can check what the agent only promises today:
- Every `sources[].url` must appear in a `web_fetch` or `web_search` result of this run, otherwise it is an error ("you did not read it").
- `accessed` is filled in by the page from the clock, not by the model.
- A quote or figure in `evidence` is checked for presence in the fetched text of the cited source where that text is available. A miss is a warning, a repeat miss is an error.
- Nodes citing a source that was only seen as a search snippet are flagged, mirroring the playbook's "summary" rule.

These checks need a prototype to tune: too strict and good stories fail, too loose and they add nothing.

## Brand

`brand-probe.mjs` fetches a site's CSS, which browsers block (CORS), and the fetch tool returns page content, not stylesheets. Options, best first:
1. Let the user pick or paste an accent colour and light/dark, with a neutral palette from `template/default-theme.json`.
2. Ask the agent to infer colours from fetched page content and the site's visible brand, and record in `brandSources` that this was inferred, not measured.
3. A small, stateless fetch proxy would solve it but is a service we would run, so it is out of scope.

Expect generated stories to be less brand-exact than ones made by a coding agent.

## Cost

- **Project:** static hosting only.
- **User:** a researched story means many search and fetch results plus several modelling passes. A rough guess is a few dollars per story on Opus 5.5 ($4 / $20 per million tokens in/out), but that is an estimate to be measured in the prototype, not a quote. The UI shows an estimate before starting, a running token and cost counter, and a hard cap the user sets; hitting the cap stops cleanly with whatever validates so far.
- A cheaper model option can be offered once evals show where quality holds.

## Publishing: tiers

| Tier | What | Cost/risk to the project |
|---|---|---|
| A. Download | User gets `index.html` and hosts it anywhere | None |
| B. Gallery submission | The page prepares a pull request that adds the story under `examples/` (or a gallery folder); a maintainer reviews it; merge deploys it | A public repo, human review time, moderation. Needs a GitHub account on the submitter's side. |
| C. Instant public hosting | Not proposed | Moderation, abuse, legal exposure, and a service (see `publishing.md`) |

Why not "commit to the public repo directly": the browser cannot push without the user's GitHub credentials or a server of ours holding a bot token; every publish would redeploy the whole site; and stories about real organisations and people on the project's domain carry moderation and legal responsibility regardless of where the bytes are stored. Tier B keeps a human in the loop and reuses the existing contribution flow and its rules (`CONTRIBUTING.md`).

## Risks

- **Quality variance** across subjects without a way to measure it. Mitigation: an eval set (a fixed list of subjects, scored on validator pass rate, source-verification pass rate, and a human rubric) before launch.
- **Cost surprises** for users. Mitigation: estimate, cap, live counter.
- **Key exposure** by page compromise. Mitigation: no third-party scripts, strict CSP, memory-only default, signed releases or pinned hosting.
- **Refusals and policy** on sensitive subjects. Handle `refusal`, show it plainly, and keep the playbook's privacy rule (no private-relationship stories, no sensitive inferences).
- **Defamation risk** on real people and companies. The disclaimer and sourcing rules apply; the page should refuse living private individuals as subjects, as `CONTRIBUTING.md` does for examples.
- **Drift** between this loop's prompts and the playbook. Mitigation: generate prompts from the playbook text, not a copy.

## Effort and phases

1. **Prototype (about a week).** A bare page with a key field and subject box, one real loop (research, `submit_story`, validate, render) on three or four subjects. Measure cost, time, validator pass rate, and source-verification behaviour. This decides whether to continue.
2. **v1 (1-2 weeks more).** UI polish, budget cap, cancel and resume, error handling, refusal handling, brand options, tests, the eval set.
3. **Gallery submission (small).** A prefilled PR flow and a contributor checklist.

Estimates assume one developer and are rough.

## Open questions

- Which audience is this for: non-technical people, or developers who would rather use their own agent? That changes how much polish v1 needs.
- Is "submit to the gallery" wanted at all, and who reviews?
- Does Anthropic's guidance on browser-side keys change how we present key entry?
- How strict should the code-enforced source checks be for quotes?
- Where is it hosted (this site's domain or elsewhere), and who is named as the operator in the privacy text?
