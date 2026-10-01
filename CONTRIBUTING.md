# Contributing

Thanks for helping. This project has one job: make it easy for an AI agent (and the person directing it) to produce a **truthful, well-made, single-file story** about any subject. Contributions that serve that job are welcome.

## Ground rules

- **Zero dependencies.** The toolkit runs on plain Node 18+ with no `npm install`. Don't add runtime or build dependencies. The output is one self-contained HTML file with no external scripts.
- **Sourced or it doesn't ship.** Examples and playbook guidance must keep the project's honesty rules: every node cites a source that was actually read; interpretations are marked `inferred`.
- **The toolkit is neutral; examples are honest.** The scripts, templates, playbook and tests must not be tied to any person, company or brand. Examples may be about real organisations or public figures, but only as honest independent studies with an accurate `disclaimer` (including "not affiliated with or endorsed by" where that applies), built only from public sources. Don't add a real living private individual as a subject.
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

## The product page

`site/` holds the product page. `node scripts/build-site.mjs` builds it into `site/dist` (set `SITE_URL` to add canonical and social-image URLs). `vercel.json` carries the static-hosting settings (build command, output directory, clean URLs, security headers), so any host that can run a Node build command and serve a folder will do. Every example gets its own page (`/stories/<slug>/`) and a standalone full page (`/stories/<slug>/full/`), and the landing page features them in an embedded viewer with a full-screen button. Example statistics are read from each story, so rebuild the examples first if you change them.

A deployer can feature extra stories without committing them: put `story.json` and `theme.json` (and an optional `thumb.webp`, plus an `order.json` array of slugs) in `site/showcase/<slug>/`. That folder is git-ignored; `.vercelignore` makes sure it is still uploaded when you deploy from your machine.

Hosting: the repository can be connected to a static host so that every push to `main` redeploys the page. The build command and output folder are in `vercel.json`; set the `SITE_URL` environment variable to the public address.

## Reporting problems

Open an issue with the subject you tried, what the agent produced, and what was wrong (a missing source, an unreadable colour, a broken view). A built `index.html` or the `story.json` helps.
