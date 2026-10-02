# Reference publishing service (sketch)

A framework-neutral handler for publishing stories to public pages without accounts. Design, protocol, abuse model and open questions: [`docs/publishing.md`](../../docs/publishing.md).

- `handler.mjs`: `createHandler({store, limiter, policy, baseUrl})` returns `(Request) => Promise<Response>`.
- `server.mjs`: local dev server with in-memory storage (`node services/publish/server.mjs 8787`).

Not production-ready: storage and rate limiting are per-process, there is no takedown path or expiry yet.
