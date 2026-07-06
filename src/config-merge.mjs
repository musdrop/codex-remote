import path from "node:path";

export function resolveOfficialCodexHome(env = process.env) {
  if (env.CODEX_HOME?.trim()) {
    return path.resolve(env.CODEX_HOME.trim());
  }
  if (process.platform === "win32") {
    const userProfile = env.USERPROFILE?.trim();
    if (!userProfile) {
      throw new Error("USERPROFILE is required to resolve the Windows Codex home");
    }
    return path.join(userProfile, ".codex");
  }
  const home = env.HOME?.trim();
  if (!home) {
    throw new Error("HOME is required to resolve the Codex home");
  }
  return path.join(home, ".codex");
}
