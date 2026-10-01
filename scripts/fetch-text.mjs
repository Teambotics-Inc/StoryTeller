#!/usr/bin/env node
// Usage: node scripts/fetch-text.mjs <https://page> [--max 60000]
// Prints a web page as plain text so you can read it and copy exact quotes. Zero dependencies, Node 18+.
// If the page is a JavaScript shell (very little text), it says so: open it in a browser tool instead.
// Caveat: tag-stripped text can leave stray spaces before punctuation; compare quotes with the rendered page.

const url = process.argv[2];
const maxIdx = process.argv.indexOf("--max");
const max = maxIdx > 0 ? Number(process.argv[maxIdx + 1]) || 60000 : 60000;
if (!url || !/^https?:\/\//i.test(url)) { console.error("usage: node scripts/fetch-text.mjs https://example.com/page [--max 60000]"); process.exit(2); }

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "-", mdash: "-", hellip: "...", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"' };
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; StoryTellerFetch/1.0)", accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
console.error(`${r.status} ${r.url}`);
if (!r.ok) { console.error("Fetch failed. If the site works in a browser, read it with a browser tool instead."); process.exit(1); }
const html = await r.text();
const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
const body = html
  .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<\/(p|div|section|article|li|h[1-6]|tr|blockquote|br)\s*>|<br\s*\/?>/gi, "\n")
  .replace(/<[^>]+>/g, " ");
const text = decode(body).replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
if (title) console.log(`# ${decode(title)}\n`);
console.log(text.slice(0, max));
if (text.length > max) console.error(`\n[truncated at ${max} of ${text.length} characters; use --max]`);
if (text.length < 400) console.error("\n! Very little text. This page is probably rendered by JavaScript or blocked: use a browser tool.");
