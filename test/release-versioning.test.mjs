import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReleaseSteps,
  normalizeReleaseVersion,
  resolveTargetVersion,
} from "../scripts/lib/release/versioning.mjs";

test("resolveTargetVersion bumps patch when no explicit version is provided", () => {
  assert.deepEqual(resolveTargetVersion({ currentVersion: "0.1.0" }), {
    version: "0.1.1",
    tag: "v0.1.1",
  });
});

test("normalizeReleaseVersion accepts an optional v prefix", () => {
  assert.deepEqual(normalizeReleaseVersion("v1.2.3"), {
    version: "1.2.3",
    tag: "v1.2.3",
  });
});

test("resolveTargetVersion rejects non-incrementing versions", () => {
  assert.throws(
    () => resolveTargetVersion({ currentVersion: "1.2.3", requestedVersion: "1.2.3" }),
    /greater than current version/,
  );
});

test("buildReleaseSteps describes the local release command sequence", () => {
  assert.deepEqual(buildReleaseSteps({ version: "1.2.4", tag: "v1.2.4" }), [
    { command: "git", args: ["status", "--porcelain"] },
    { command: "git", args: ["add", "package.json"] },
    { command: "git", args: ["commit", "-m", "chore: release v1.2.4"] },
    { command: "git", args: ["tag", "-a", "v1.2.4", "-m", "Release v1.2.4"] },
    { command: "git", args: ["push", "origin", "HEAD", "--follow-tags"] },
  ]);
});
