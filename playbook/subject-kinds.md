# Subject kinds: clusters, research recipes, pitfalls

Anything with a story works. Use these as starting points, not templates: pick clusters that fit *this* subject.

## Company / brand / organisation
- **Clusters**: Identity · How they work · Offer/capabilities · Proof (cases, metrics) · Thinking (publications, leaders) · People & partners · History.
- **Research**: homepage + nav, About, Work/case studies, Insights/blog, Press, Leadership, Careers, Investors/filings, independent press, reviews, criticism.
- **Edges that matter**: method → result (with a case as proof), belief → practice, product → customer, founder → decision. Company-reported metrics are *claims*; word them so.
- **Theme**: extract from the site ([`4-brand.md`](4-brand.md)).
- **Pitfall**: a map made only of the company's own copy is marketing. Add independent sources and any real tensions.

## Person
- **Clusters**: Origins · Work · Ideas · Influences · Collaborators · Places · Milestones/recognition.
- **Research**: their own site/bio, published work, interviews, institutional pages, reputable profiles. Public figures only, or material supplied by the subject.
- **Edges**: influenced by, collaborated with, led to, taught by, published.
- **Privacy**: no inference about health, family, orientation, beliefs, or finances unless they publicly made it part of their story. Living private individuals: only with the user's material and consent.
- **Theme**: their site if they have one; otherwise a considered palette.

## Relationship (two people, a team, a couple, founders, a family line)
- **Clusters**: Each person's thread · Where paths crossed · Shared work/projects · Turning points · Places · Things that stayed.
- **Research**: primarily **what the user provides** (messages, photos' captions, dates, anecdotes). Ask for consent and scope first; keep the disclaimer honest ("Built from <user>'s own account").
- **Edges**: met, introduced, built together, moved to, reconciled. Mark anything you inferred as `inferred`.
- **Pitfall**: don't invent motives or feelings. Sources here are memories; say so.
- **Theme**: warm neutral palette; no brand borrowing.

## Word / etymology
- **Nodes**: the modern word, earlier forms by language and era, roots, cognates, semantic shifts, key texts where it appears, related concepts. Use `when` ("c. 1300 CE") heavily; `type`: word-form, root, language, shift, text.
- **Clusters**: Modern use · Middle/Old forms · Root languages (PIE, Latin, Greek, Germanic...) · Cognates · Meaning shifts.
- **Research**: OED / Etymonline / Wiktionary for orientation, then scholarly references and dictionaries of the source language. Note scholarly disagreement as nodes.
- **Edges**: "derived from", "borrowed into", "cognate of", "narrowed to", "replaced by".
- **Stories**: the main lineage as a path; a famous false etymology vs the real one.
- **Theme**: archive/parchment palette.

## History / event / era
- **Nodes**: causes, actors, decisions, battles/meetings/laws, consequences, places, documents. Use `when`.
- **Clusters**: Background · Actors · Key moments · Consequences · Sources & memory (how it's remembered/disputed).
- **Research**: primary documents and archives first; then academic histories; flag historiography debates as their own node.
- **Edges**: led to, responded to, enabled, opposed.
- **Stories**: the causal chain; the contested interpretation.

## Place / geography
- **Nodes**: districts, landmarks, institutions, eras of change, communities, economic drivers, natural features, events tied to locations.
- **Clusters**: Land & water · Settlement & eras · Economy · Culture & people · Landmarks · Change.
- **Research**: municipal/government data, archives, geological surveys, heritage registers, local histories.
- **Edges**: shaped, built on, displaced, connected by, named for.
- **Theme**: map-like palette.

## Product / project / technology
- **Clusters**: Problem · Design decisions · Architecture/components · Users & adoption · Milestones · Competitors/alternatives.
- **Research**: docs, changelogs, repos, talks, postmortems, issue trackers, independent reviews.
- **Edges**: replaced, depends on, motivated by, shipped in.

## Idea / concept / movement
- **Clusters**: Origin · Core claims · Key people · Evidence · Critiques · Applications · Descendants.
- **Research**: original texts, canonical secondary works, strongest critiques.
- **Stories**: from first formulation to present; claim vs strongest objection.

## Which views suit which subject

Etymology, history, biography, product evolution: give nodes `start`/`end` and lead with `defaultView: "timeline"`. Companies, ideas, relationships: Graph first; add dates only where the sources support them. If the story is meant to be read rather than explored, set `defaultView: "read"` and put care into the guided stories.

## Choosing sizes
Company 30-60 nodes · person 25-50 · relationship 15-35 · etymology 15-35 · event 20-45 · place 25-55 · idea 20-45. When you exceed ~80, split into two stories and link them in the tagline.
