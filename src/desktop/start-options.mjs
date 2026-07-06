import { parseArgs } from "node:util";

import { resolveCodexCommand } from "./codex-command.mjs";

export function buildStartDaemonOptions({
  argv = [],
  env,
  exists,
  platform,
  resolveCodex,
} = {}) {
  const { values } = parseArgs({
    allowNegative: true,
    args: argv,
    options: {
      codex: { type: "string" },
      config: { type: "string" },
      relay: { type: "string" },
      web: { type: "string" },
      "prevent-sleep": { type: "boolean" },
    },
  });

  const codex = values.codex
    ? resolveCodexCommand({
        env: { ...(env ?? {}), CODEX_REMOTE_CODEX: values.codex },
        exists,
        platform,
      })
    : (resolveCodex
        ? resolveCodex()
        : resolveCodexCommand({ env, exists, platform }));

  return {
    configPath: values.config,
    codexSource: values.codex ? "arg" : codex.source,
    overrides: {
      codexCommand: codex.command,
      relayUrl: values.relay,
      webUrl: values.web,
      preventSleep: values["prevent-sleep"],
    },
  };
}
