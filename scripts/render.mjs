// Renders a validated story + theme into one self-contained HTML string. No dependencies; Node 18+.
// Used by build.mjs (local files) and by the reference publishing service (services/publish/).
// The browser-safe core is in render-core.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderWithTemplate } from "./render-core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

export function renderStory(story, theme) {
  return renderWithTemplate(story, theme, fs.readFileSync(path.join(here, "..", "template", "story.html"), "utf8"));
}
