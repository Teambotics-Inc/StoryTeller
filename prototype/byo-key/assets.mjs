// Node-only: loads the repository text the agent needs (playbook, schemas, template) from disk.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");

export function loadAssets() {
  return {
    agents: read("AGENTS.md"),
    playbook: { scope: read("playbook", "1-scope.md"), research: read("playbook", "2-research.md"), model: read("playbook", "3-model.md"), brand: read("playbook", "4-brand.md") },
    storySchema: read("schema", "story.schema.json"),
    themeSchema: read("schema", "theme.schema.json"),
    defaultTheme: read("template", "default-theme.json"),
    template: read("template", "story.html"),
  };
}
