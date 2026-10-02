# Publishing a story to a public page (design sketch)

Status: a reference implementation and a client exist, but nothing here is deployed. Operating a public no-account host is a product decision; this document is what that decision would need to cover.

## Goal

After building a story, an agent can put it on a public URL **without the user creating an account anywhere**, only when the user asks for that. The result is the same single-file viewer, so graph, timeline and the other views all work (a wiki or notes tool would flatten them).

If no service is configured, nothing changes: `index.html` is one file that can go on any static host.

## Shape

```
agent ── scripts/publish.mjs ──► POST /v1/stories ──► service ──► storage
          (validates locally,         {story, theme}     validate, render,
           dry run unless --yes)                         store, return id + token
reader ──────────────────────► GET /s/<id>/ ──► the rendered page
```

Clients send `story.json` and `theme.json`, **never HTML**. The service validates them with `scripts/validate.mjs` and renders with `scripts/render.mjs`, the same code as the local build. A published page therefore always comes from the audited template, and nobody can use the host to serve arbitrary scripts.

## Protocol (v1)

| Request | Auth | Result |
|---|---|---|
| `POST /v1/stories` body `{story, theme}` | none, rate limited | `201 {id, url, editToken}` |
| `PUT /v1/stories/<id>` body `{story, theme}` | `Authorization: Bearer <editToken>` | `200 {id, url}` |
| `DELETE /v1/stories/<id>` | `Authorization: Bearer <editToken>` | `200 {deleted}` |
| `GET /s/<id>/` | none | the page |

Errors are JSON `{error, details?}`: `400` bad JSON, `403` bad token, `404` unknown id, `413` over 1 MB, `422` failed validation or policy, `429` rate limited.

- **No accounts.** The edit token is the only credential. It is returned once; the service stores only its SHA-256. The client saves it in `<story-dir>/.publish.json` (mode 600, git-ignored), which is what `--update` and `--delete` use.
- **Ids** are 12 random base32 characters (60 bits). Pages are unlisted, not private: anyone with the link can read them.

## Safety and abuse

A free, anonymous, public host will be tried by spammers and by people wanting to host misleading content. The sketch includes the cheap defences and lists the rest:

Included:
- Server-side render only (no client HTML), plus the existing validator, which refuses unsourced or unreadable stories.
- Size and shape limits: 1 MB body, 200 nodes, 500 edges, 200 sources.
- A policy hook (`defaultPolicy`): no private-relationship stories; `credit` and `disclaimer` required.
- Per-client rate limit (in-memory in the sketch).
- Page headers: `X-Robots-Tag: noindex`, and a CSP that allows no network access (`default-src 'none'`; inline script and style only, Google Fonts for styles). Serve pages from their own origin, not the origin that hosts the API or any site with cookies.
- Constant-time token comparison; tokens never logged.

Needed before running it for real:
- A shared rate limiter and an IP-reputation or proof-of-work step on `POST`.
- A report/takedown path (`/report/<id>`, a monitored inbox) and an operator-side delete.
- Expiry (for example 90 days without an update) so abandoned pages do not accumulate.
- Content checks beyond structure, for example a blocklist, and optionally holding first-time publishers for review.
- A visible footer on published pages saying where they were made and how to report them.
- Abuse monitoring and a written terms page.

## Agent rules

These belong in `AGENTS.md` and `playbook/6-publish.md`: publishing is public and outward-facing, so the agent runs `publish.mjs` without `--yes` first, shows the user the URL target and what will be public, and passes `--yes` only after the user says yes for that story. Private-relationship stories are never published. The agent reports the URL and mentions that the edit token is in `.publish.json`.

## Storage

The handler takes a storage adapter `{get, put, delete}` over records `{html, title, tokenHash, createdAt, updatedAt}`. The sketch ships an in-memory adapter. Production candidates: object storage (one object per page, pages served straight from the bucket or a CDN, which also gives cheap immutable caching) or a KV store. Pages are about 100 KB, so cost is dominated by traffic, not storage.

## Alternatives considered

| Option | Why not the default |
|---|---|
| Notion, Google Docs, pastebins | Need accounts, and cannot run the interactive viewer. |
| GitHub Pages or gists | Need a GitHub account. Good as a documented self-host path. |
| Anonymous static hosts (surge.sh, tiiny.host, Netlify Drop and similar) | Work today with no code: upload `index.html`. Terms and retention vary and are outside our control. Documented as the fallback. |
| A claimable deploy in the style of neon.new | Best experience (publish now, claim later), but a larger service to build. A possible v2 on top of this protocol. |

## Open questions

- Who operates the default host and under what terms? The toolkit must stay neutral, so the URL is configuration (`--to` or `STORYTELLER_PUBLISH_URL`), never a built-in default.
- Retention: expiry period, and whether editing renews it.
- Whether to let authors opt in to search indexing. The sketch is `noindex` only.
- Whether published pages should carry the service's own footer, and how that interacts with a story's `credit` and `disclaimer`.
- Whether a human review step is acceptable for first-time publishers, given the "no account" goal.

## Running the sketch

```bash
node services/publish/server.mjs 8787            # in-memory, local only
node scripts/build.mjs stories/my-subject
node scripts/publish.mjs stories/my-subject --to http://localhost:8787          # dry run
node scripts/publish.mjs stories/my-subject --to http://localhost:8787 --yes    # publish
node scripts/publish.mjs stories/my-subject --to http://localhost:8787 --update --yes
node scripts/publish.mjs stories/my-subject --to http://localhost:8787 --delete --yes
```

`http://` is accepted only for localhost; any real service must be `https://`.
