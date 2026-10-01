# 1. Scope the story

Goal: decide *what story*, for whom, within what limits, before you touch a source. Five minutes here saves a rebuild.

## Write a brief (in your head or in `research.md`)

- **Subject**: the precise thing. "Venice" (the city) vs "the Venetian Republic" (the state) vs "the history of canals" are three different stories. Pick one; link to the others as nodes if they matter.
- **Kind**: person, company/brand, relationship, word/etymology, event/history, place, product, idea. See [`subject-kinds.md`](subject-kinds.md) for cluster ideas and research recipes per kind.
- **Angle**: the one-sentence claim the map will let a reader *see*. Examples: "How a company's method produces its results." "How *salary* traces back to Roman soldiers and salt." "How these two founders' paths crossed before the company existed." If you can't state the angle, keep researching a little and then pick the most interesting true thing you've found.
- **Audience and use**: a founder sharing it publicly, a teacher, a pitch, a family keepsake. It changes tone and how much to include.
- **Boundaries**: time range, geography, what's out of scope.

## When to ask the user

Ask only when the answer would change the work materially and you can't pick a sensible default. Max three questions, asked together, each with your default stated:

- Ambiguous subject ("Mercury": planet, element, band, or car?).
- Private material: for relationships or living private individuals, what may you use and is it OK to publish?
- Credit name: what name (if any) should appear in `credit`? If you can't ask, omit the name ("An independent StoryTeller study.") and say so in your final message.
- Affiliation: is the user the subject/affiliated, or an independent observer? (Drives `credit` and `disclaimer`.)
- Brand vs neutral: only if the subject is a brand but the user wants something different.

Otherwise decide, note your assumption in the final message, and move on.

## Affiliation and credit

Fill `credit` and `disclaimer` honestly:

- Independent study of a public subject: `credit: "An independent StoryTeller study by <user name>."`, `disclaimer: "Built from <Subject>'s public <pages/work/records>. Not affiliated with or endorsed by <Subject>."`
- Made by or for the subject: say so.
- Built from user-supplied private material: say that, and don't imply public sourcing.

Matching a brand's colours is fine for an honest study. Do not use their logo as if it were an endorsement; if you embed a logo, keep the disclaimer.

## Slug and folder

`stories/<kebab-case-subject>/`. Keep `research.md`, `story.json`, `theme.json`, and the built `index.html` together so a reviewer can trace everything.
