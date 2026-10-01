# Contributing

Thanks for helping. This project has one job: make it easy for an AI agent (and the person directing it) to produce a **truthful, well-made, single-file story** about any subject. Contributions that serve that job are welcome.

## Ground rules

- **Zero dependencies.** The toolkit runs on plain Node 18+ with no `npm install`. Don't add runtime or build dependencies. The output is one self-contained HTML file with no external scripts.
- **Sourced or it doesn't ship.** Examples and playbook guidance must keep the project's honesty rules: every node cites a source that was actually read; interpretations are marked `inferred`.
- **Neutral by default.** The repo should not be tied to any person, company or brand. Examples should be subjects where a neutral treatment is natural (words, events, places, ideas, public-domain works). Don't add a real living private individual as a subject. An example about a real organisation or public figure must be an honest independent study with an accurate `disclaimer`, built only from public sources.
- **Short, concrete playbook text.** The playbook is read by agents. Prefer rules with an example and a reason over general advice.

## Making changes

```bash
node --test tests/toolkit.test.mjs      # run the tests
node scripts/build.mjs examples/<name>  # rebuild an example after changing the template, schema or its data
```

- Changing `template/story.html`, `scripts/` or the schema? Rebuild every example (the test suite fails if a committed `index.html` is stale).
- Changing a validator rule? Add a test for it in `tests/toolkit.test.mjs`, and make sure every example still validates with no warnings.
- Changing the renderer? Open an example in a real browser at desktop and phone widths, and check every view (graph, timeline, read, outline, list), search/filter, the detail panel, and the console.

## Adding an example

1. Follow `AGENTS.md` end to end in `stories/<slug>/` (research log, `story.json`, `theme.json`, built `index.html`).
2. It must pass the build with **zero warnings**.
3. Move it to `examples/<slug>/` and open a pull request that explains what the example demonstrates that the existing ones don't (a different subject kind, theme mode, view, or source situation).

## Reporting problems

Open an issue with the subject you tried, what the agent produced, and what was wrong (a missing source, an unreadable colour, a broken view). A built `index.html` or the `story.json` helps.
