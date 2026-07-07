const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)$/;

export function normalizeReleaseVersion(input) {
  const value = String(input ?? "").trim();
  const match = SEMVER_RE.exec(value);
  if (!match) {
    throw new Error("Release version must look like 1.2.3 or v1.2.3.");
  }

  const version = `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
  return { version, tag: `v${version}` };
}

export function resolveTargetVersion({ currentVersion, requestedVersion } = {}) {
  const current = normalizeReleaseVersion(currentVersion);
  const target = requestedVersion
    ? normalizeReleaseVersion(requestedVersion)
    : bumpPatch(current.version);

  if (compareVersions(target.version, current.version) <= 0) {
    throw new Error(`Release version ${target.version} must be greater than current version ${current.version}.`);
  }

  return target;
}

export function buildReleaseSteps({ version, tag }) {
  return [
    { command: "git", args: ["status", "--porcelain"] },
    { command: "git", args: ["add", "package.json"] },
    { command: "git", args: ["commit", "-m", `chore: release ${tag}`] },
    { command: "git", args: ["tag", "-a", tag, "-m", `Release ${tag}`] },
    { command: "git", args: ["push", "origin", "HEAD", "--follow-tags"] },
  ];
}

function bumpPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return normalizeReleaseVersion(`${major}.${minor}.${patch + 1}`);
}

function compareVersions(left, right) {
  const l = left.split(".").map(Number);
  const r = right.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (l[i] !== r[i]) {
      return l[i] > r[i] ? 1 : -1;
    }
  }
  return 0;
}
