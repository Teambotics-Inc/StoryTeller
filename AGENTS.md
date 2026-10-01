# StoryTeller: instructions for AI agents

You were pointed at this repo because a person wants a **story** told about a subject. Your job: research it properly, model it as a sourced graph, style it to fit the subject (brand colours if it has a brand), and deliver **one self-contained `index.html`** they can open, share, or host.

Subjects can be anything with a story: a person, a brand, a company, a relationship, a word's etymology, a historical event, a place, a product, an idea. See [`playbook/subject-kinds.md`](playbook/subject-kinds.md).

The finished references are in [`examples/`](examples/). Open an example's `index.html` to see the quality bar, and read its `story.json` and `theme.json` to see the data. [`examples/salary/`](examples/salary/) is a word's etymology: light theme, dated nodes, and a disputed source modelled as its own node. [`examples/great-fire-of-london/`](examples/great-fire-of-london/) is a historical event: dark theme, day-level dates (lead with the Timeline), and sources that disagree shown side by side rather than resolved. [`examples/rosetta-stone/`](examples/rosetta-stone/) is a historical object: claims that rest on Wikipedia are attributed as such, and open disagreements (discovery date, material, treaty name) are shown rather than picked.

## Hard rules

1. **No invention.** Every node cites at least one source you actually read. Every `explicit` edge cites one. A relationship you are interpreting is `inferred` (the UI draws it dashed and labels it). Never present a guess as a fact. Numbers and quotes are copied exactly from the source, never rounded or "improved".
2. **Sources are real and dated.** Record the URL and the day you read it. If you could not fetch a page, you did not read it. Do not cite it.
3. **Brand-match when a brand exists; be neutral when one doesn't.** Derive colours and fonts from the subject's own site (see step 4). Do not guess a brand colour from memory. If the subject is a private person or an abstract idea, use the neutral theme or a considered palette; never borrow an unrelated company's look.
4. **Privacy.** For people and relationships: public sources only, or material the user gave you for this purpose. Do not infer health, sexuality, religion, finances, or other sensitive attributes. If the user wants a private relationship mapped, work only from what they supply and say so in `disclaimer`.
5. **Copyright.** Summarise in your own words. `evidence` holds short facts, figures, or a brief quote (under ~25 words) exactly as the source states them.
6. **Don't hand-author layout.** No coordinates. The renderer does layout.
7. **Validate before you claim done.** `node scripts/build.mjs <dir>` must pass with errors at zero and warnings read and addressed (or consciously accepted and reported).

## The workflow

Work in a new folder, e.g. `stories/<subject-slug>/` (create `stories/` if needed; `examples/` is reference material, don't put new work there).

| Step | Read | You produce |
|---|---|---|
| 1. Scope | [`playbook/1-scope.md`](playbook/1-scope.md) | A one-paragraph brief: subject, angle, audience, boundaries. Ask the user only what you truly can't default (max 3 questions). |
| 2. Research | [`playbook/2-research.md`](playbook/2-research.md) | `stories/<slug>/research.md`: a source log with dated URLs and extracted facts. |
| 3. Model | [`playbook/3-model.md`](playbook/3-model.md) | `stories/<slug>/story.json` (schema: [`schema/story.schema.json`](schema/story.schema.json)). |
| 4. Brand | [`playbook/4-brand.md`](playbook/4-brand.md) | `stories/<slug>/theme.json` (schema: [`schema/theme.schema.json`](schema/theme.schema.json)). |
| 5. Build & verify | [`playbook/5-build-and-verify.md`](playbook/5-build-and-verify.md) | `stories/<slug>/index.html`, checked in a browser on desktop and mobile widths. |

If the user gives you a starting URL, treat it as the first source, not the only one: research beyond it (other pages on the site, independent coverage, primary records) as `playbook/2-research.md` describes.

Build command (no install needed, Node 18+):

```bash
node scripts/build.mjs stories/<slug>          # validate + write stories/<slug>/index.html
node scripts/build.mjs stories/<slug> --check  # validate only
```

If you have no Node, see the fallback in step 5. If you have no browser tool, say so and list what you could not visually check.

## What good looks like

- **A point of view.** The tagline and the `stories` (guided paths) each argue something ("how the method produces the results", "where the name came from"). A pile of facts is not a story.
- **Right size.** Typically 20-60 nodes (a single word or a small relationship can be 15-30), 4-9 clusters, 3-6 stories. Under ~15 feels thin; over ~80 becomes a hairball, so split it into several stories. If the user names a size, follow it.
- **Time, when the subject has it.** If the story is chronological, give nodes honest `start`/`end` dates so the Timeline view appears (see "Formats" in `playbook/3-model.md`). Don't invent dates to unlock it.
- **Edges that say something.** Labels are relationships ("derived from", "led to", "funded by"), not "related to".
- **Honest seams.** What the sources don't cover is named in your final message, not papered over.
- **It looks like the subject.** Open the result next to the subject's own site. It should feel like it belongs to the same family.

Keep scratch material (raw page text, notes) in `stories/<slug>/raw/`. It is git-ignored; delete it if you like.

## Final message to the user

Keep it short: the path to `index.html`, node/edge/source counts, how many edges are inferred, which views the page offers (graph, timeline, read, outline, list), the brand choices and where they came from, anything you could not verify or cover, and how to host it (any static host; it is one file).
