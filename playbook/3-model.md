# 3. Model the story

Goal: turn the source log into `story.json`. Schema: [`../schema/story.schema.json`](../schema/story.schema.json). Worked example: [`../examples/salary/story.json`](../examples/salary/story.json).

## Shape

```jsonc
{
  "schemaVersion": 1,
  "title": "Subject",
  "subject": { "name": "Subject", "kind": "company", "url": "https://..." },
  "tagline": "One sentence: what this map lets you see.",
  "root": "subject",                 // node id at the centre
  "credit": "...", "disclaimer": "...",
  "generated": { "date": "YYYY-MM-DD" },
  "clusters": [ { "id": "identity", "label": "Identity" } ],
  "sources":  [ { "id": "home", "title": "...", "url": "https://...", "accessed": "YYYY-MM-DD" } ],
  "nodes":    [ { "id": "...", "title": "...", "type": "concept", "cluster": "identity",
                  "summary": "1-2 sentences", "details": "optional", "evidence": "exact fact/quote",
                  "when": "optional", "sources": ["home"], "themes": ["..."], "featured": false } ],
  "edges":    [ { "source": "a", "target": "b", "label": "led to", "kind": "explicit", "sources": ["home"] } ],
  "stories":  [ { "id": "...", "title": "...", "summary": "...", "steps": ["a", "b", "c"] } ]
}
```

## Design rules

**Root.** One node at the centre: the subject. Everything should be reachable from it (the validator warns if not).

**Clusters** are the thematic regions that give the map its structure and colour: 4-9 of them. Name them for what the reader will think ("How we work", "Evidence", "Origins"), not for data types. Ideas per subject kind are in [`subject-kinds.md`](subject-kinds.md).

**Nodes** are things worth stopping at: a concept, a capability, an event, a person, a place, a word form, a case study, a number that matters. Rules of thumb:

- Title ≤ 30 characters so labels don't collide. Use the subject's own terms.
- Summary: 1-2 sentences, own words, says *why it matters to this story*, not only what it is.
- `evidence`: the concrete, checkable thing (a figure, date, short quote) exactly as sourced. Attribute claims ("Example Co reports…").
- One idea per node. Split "AI, design and engineering" into three.
- `featured: true` on at most ~15% of nodes: the ones a skimming reader should see first.
- `type` is free-form but keep a small consistent vocabulary (5-8 types).
- Metrics/outcomes as nodes are fine when they're load-bearing in the argument; don't make a node for every statistic.

**Edges** are the story. A map with only hub-and-spoke edges to the root is a bullet list.

- **Direction**: an edge reads `source -[label]-> target`, e.g. `salarium -[turned into]-> salary`. The panel shows outgoing as → and incoming as ←. Phrase the label so that sentence is true ("derived from" goes from the later word to the earlier one).
- `label` is a relationship a reader can read aloud between the two titles: "founded", "derived from", "shaped", "tested by", "proven in", "then".
- `explicit`: a cited source states or directly shows it. Must have `sources`.
- `inferred`: your editorial connection between things the sources discuss separately. No source needed, but the reader sees it dashed. Keep these **under ~35%**, and never use them to assert a fact (causation, motive, dates). The validator warns at 50%.
- Include cross-cluster edges: they are where the insight is. Sequences (A then B then C) are good for processes and timelines.
- Avoid duplicates between the same pair of nodes and avoid edges to the root from everything; connect things to what they actually relate to.

**Stories (guided paths).** 3-6 ordered `steps` through the graph, each making one argument in a few sentences of `summary`:

- "Identity to outcomes": the thesis.
- A process or timeline walked in order.
- A single deep case.
- A tension or contrast ("what they say vs what the evidence shows").

Steps should follow real edges (the validator warns when most steps jump between unconnected nodes); the renderer draws the path and numbers the nodes.

**Tagline.** One sentence, specific, no hype. Good: "How a word for salt became the word for pay, and why nobody can prove the story everyone tells." Bad: "Discover the amazing story of X!"

## Formats: one story, several ways to see it

The same data renders in up to five views; the reader switches between them in the page. You choose which to offer by what you put in the data:

| View | Best for | What it needs from you |
|---|---|---|
| **Graph** | seeing how things connect; exploring | nothing extra (always on) |
| **Timeline** | anything that unfolds in time: history, etymology, careers, product evolution | `start` (and optional `end`) on at least **5** nodes |
| **Read** | handing someone a narrative to read top to bottom | at least one entry in `stories`; write each story's `summary` and step `summary`/`evidence` well, because this view reads them as prose |
| **Outline** | scanning structure like a table of contents | nothing extra (built from the root outward) |
| **List** | fast lookup by theme | nothing extra |

Timeline dates: `start`/`end` are date-only strings: `"1666-09-02"`, `"1666-09"`, `"1666"`, or negative for BCE (`"-0500"`). Keep `when` as the human wording ("2 September 1666, about 1am", "late 13c."). Honest ranges beat false precision: if a source says "13th century", use `start: "1201", end: "1300"`, not `"1250"`. Undated nodes (people, concepts) simply have no `start`; they still appear in every other view.

Choosing: a **process, history, biography or etymology** deserves dates, so give it the Timeline. A **company, idea or relationship** usually does not; don't invent dates to unlock a view. Set `defaultView` (e.g. `"timeline"` for a chronology, `"read"` for something meant to be read) and `views` (to restrict or reorder) only when the default (Graph first, everything that applies) is wrong for the subject.

## Quality checklist (before building)

- [ ] Every node has sources; every `explicit` edge has sources.
- [ ] Every number/quote matches the source text exactly.
- [ ] Claims by the subject about itself are worded as claims.
- [ ] No node or edge asserts something only you concluded, unless `inferred`.
- [ ] Each cluster has ≥3 nodes; each story has a clear point.
- [ ] Complicating or critical facts from credible sources are represented, not omitted.
- [ ] IDs are short kebab-case and unique; titles are short.
- [ ] If the subject is chronological: 5+ nodes have honest `start`/`end` values and the timeline reads correctly.
- [ ] Each story reads well as prose in the Read view (summary + evidence make sense without the graph).

Then build once to get the validator's feedback (step 5) and iterate. Warnings are guidance: read them.
