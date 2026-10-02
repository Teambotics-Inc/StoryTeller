#!/usr/bin/env node
// Local dev server for the reference publishing service: node services/publish/server.mjs [port]
// In-memory storage, so everything is lost on restart. Not for production; see docs/publishing.md.
import http from "node:http";
import { createHandler } from "./handler.mjs";

const port = Number(process.argv[2] || process.env.PORT || 8787);
const handle = createHandler({ baseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${port}` });

http.createServer(async (nreq, nres) => {
  const chunks = [];
  for await (const c of nreq) chunks.push(c);
  const noBody = ["GET", "HEAD"].includes(nreq.method);
  const req = new Request(`http://${nreq.headers.host}${nreq.url}`, { method: nreq.method, headers: nreq.headers, body: noBody ? undefined : Buffer.concat(chunks) });
  const res = await handle(req);
  nres.writeHead(res.status, Object.fromEntries(res.headers));
  nres.end(Buffer.from(await res.arrayBuffer()));
}).listen(port, () => console.log(`publish service on http://localhost:${port}`));
