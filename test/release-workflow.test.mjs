import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");

test("release workflow is triggered by semantic version tags", () => {
  assert.match(workflow, /tags:\s*\n\s+- "v\*\.\*\.\*"/);
});

test("release workflow builds the Windows installer and creates a GitHub release", () => {
  assert.match(workflow, /runs-on: windows-latest/);
  assert.match(workflow, /node-version: 24/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build:desktop:win/);
  assert.match(workflow, /gh release create/);
});
