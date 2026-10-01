# 2. Research

Goal: a **source log** you can build a truthful graph from. The quality of the story is capped by the quality of what you read here.

## Gather

Aim for **10-25 sources** for a company/person/place, fewer for a single word or event. Prefer primary sources and breadth across *kinds* of page, because the interesting edges live between them.

Source tiers (use the highest available; say which tier in your log):

1. **Primary**: the subject's own site, filings, official bios, archives, original documents, the word's dictionary entry, government records.
2. **Reputable secondary**: major press, peer-reviewed work, established reference works (OED, Britannica, national archives), long-form profiles.
3. **Tertiary / crowd**: Wikipedia and similar. Fine for orientation and for finding primary sources; cite the primary source it points to where you can. Never the only source for a contested claim.
   (Enthusiast sites and personal essays sit between tiers 3 and 4: fine for leads and for showing that a disagreement exists, never the sole support for a factual claim.)
4. **Avoid**: anonymous forums, SEO farms, AI-generated summaries, anything you can't trace.

How to read the web well:

- Start at the subject's homepage and follow the navigation: About/Who we are, How we work, Work/Case studies, Insights/Blog, Press, Careers, Leadership, Timeline/History, Investors. Check `/sitemap.xml` for pages navigation hides.
- If a plain fetcher gets a maintenance page, a bot wall, or an empty shell while the site works for people, retry in a browser tool (navigate, then read the page text). Plain fetchers can also be region-redirected; note which domain you actually read.
- If a page returns an empty shell (a client-rendered SPA), use a browser tool to render it, or look for the site's JSON/API, RSS feed, or a prerendered variant. Don't cite what you couldn't read.
- Search the open web for what the subject doesn't say about itself: independent coverage, history, controversies, criticism. A story with only self-description reads as marketing. Include the complicating facts too, where the sources support them.
- For etymology, history, and geography, corroborate across at least two independent references; note disagreements between them as their own node or in `details`.

## Log as you go (`research.md`)

For each source: an id, title, URL, publisher, **date accessed** (today), tier, and 2-6 bullet facts lifted precisely. Mark every number and quote as copied, and mark any source you only saw through a summarising fetcher as "(summary)"; don't use those for quotes or contested facts. Example:

```md
### about: "Our story"
- https://www.example.com/about · Example Co · accessed YYYY-MM-DD · tier 1
- "Founded in 1998 in a garage" (copied)
- Claims 65% of orders ship same-day (company claim, not independently verified)
```

Distinguish **what a source says** from **what a source proves**. A company's own metric is a *claim by the company*; word it that way in `evidence`/`details` ("Example Co reports…").

## Stop when

- Every cluster you're planning has 3+ nodes backed by sources, and
- you can state the angle in one sentence and point to the evidence, and
- new pages are repeating what you already have.

If a part of the subject is thinly sourced, *say so* (final message) rather than padding it with inference.

## Quotes need raw text

Some fetch tools return a model-written digest of a page, not the page. Never put a digest's wording in `evidence` as if it were a quote. For any figure or quote, get the raw text (curl the URL, or read it in a browser tool) and copy from that. If you only have a digest, paraphrase and say "per <source>", or leave the quote out. Put the assumptions you made without asking the user (scope, angle, affiliation) at the top of `research.md`.

## Conflicts and gaps

- Sources disagree: model both as nodes or capture in `details` ("Source A dates this to 1854; Source B to 1857"). Don't silently pick. If the only sources you can reach contradict each other about a primary text you couldn't read yourself, make the disagreement its own node and say so; do not resolve it by guessing.
- Undated or unverifiable claims: leave them out, or include with explicit hedging and `inferred` edges.
- Anything you'd be uncomfortable seeing quoted back by the subject: re-check it against the source text.
