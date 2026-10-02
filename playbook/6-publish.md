# 6. Publish (optional, only when the user asks)

The deliverable is `index.html`, one file the user can host anywhere. Do this step only if the user asks for a public link **and** a publishing service is configured (`--to <url>` or `STORYTELLER_PUBLISH_URL`). If neither holds, say that `index.html` can go on any static host and stop.

Publishing is public and outward-facing, so ask first:

1. Run the dry run and read its output to the user: the story title, the size, and the service it would go to.

   ```bash
   node scripts/publish.mjs stories/<slug> --to <service-url>
   ```

2. Tell the user the page will be visible to anyone with the link and is not indexed by search engines. Ask for a yes **for this story**; one yes does not cover later stories.
3. Only then publish:

   ```bash
   node scripts/publish.mjs stories/<slug> --to <service-url> --yes
   ```

4. Report the URL. Mention that the secret edit token is saved in `stories/<slug>/.publish.json` (git-ignored; do not paste it anywhere), and that `--update --yes` replaces the page and `--delete --yes` removes it.

Never publish stories about private relationships or built from private material; the script and the service refuse them. The design and its limits are in [`../docs/publishing.md`](../docs/publishing.md).
