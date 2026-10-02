#!/usr/bin/env node
// Local dev server for the reference publishing service: node services/publish/server.mjs [port]
// In-memory storage, so everything is lost on restart. Not for production; see docs/publishing.md.
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createHandler, LIMITS } from "./handler.mjs";

// Adapts a (Request, ctx) => Response handler to node:http. The body cap is enforced here, while streaming,
// so an oversized upload is cut off at ingress instead of being buffered first.
export function nodeListener(handle, { maxBytes = LIMITS.bodyBytes } = {}) {
  const tooBig = (res) => { res.writeHead(413, { "content-type": "application/json", connection: "close" }); res.end(JSON.stringify({ error: `body over ${maxBytes} bytes` })); };
  return async (nreq, nres) => {
    const noBody = ["GET", "HEAD"].includes(nreq.method);
    if (!noBody && Number(nreq.headers["content-length"]) > maxBytes) return tooBig(nres);
    const chunks = [];
    let size = 0;
    if (!noBody) {
      for await (const c of nreq) {
        size += c.length;
        if (size > maxBytes) { tooBig(nres); nreq.destroy(); return; }
        chunks.push(c);
      }
    }
    const req = new Request(`http://${nreq.headers.host}${nreq.url}`, { method: nreq.method, headers: nreq.headers, body: noBody ? undefined : Buffer.concat(chunks) });
    const res = await handle(req, { ip: nreq.socket.remoteAddress });
    nres.writeHead(res.status, Object.fromEntries(res.headers));
    nres.end(Buffer.from(await res.arrayBuffer()));
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.argv[2] || process.env.PORT || 8787);
  const handle = createHandler({ baseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${port}`, trustProxy: process.env.TRUST_PROXY === "1" });
  http.createServer(nodeListener(handle)).listen(port, () => console.log(`publish service on http://localhost:${port}`));
}
