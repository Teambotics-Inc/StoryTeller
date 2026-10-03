# Vendored SDK

`anthropic-sdk.mjs` is `@anthropic-ai/sdk` 0.131.0 (MIT licence, Copyright Anthropic, PBC) bundled for browsers with esbuild, so the page loads no third-party scripts near an API key.

Rebuild after bumping the version in `../../package.json`:

```bash
cd prototype/byo-key && npm install
echo 'export { default, Anthropic } from "@anthropic-ai/sdk";' > _entry.mjs
npx esbuild _entry.mjs --bundle --format=esm --platform=browser --minify --target=es2022 --outfile=web/vendor/anthropic-sdk.mjs --legal-comments=none
rm _entry.mjs
```
