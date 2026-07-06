import { parseArgs } from "node:util";

import { resolveCodexCommand } from "./codex-command.mjs";

export function buildStartDaemonOptions({
  argv = [],
  env,
  exists,
  platform,
  resolveCodex,
} = {}) {
  const { positionals, values } = parseArgs({
    allowNegative: true,
    allowPositionals: true,
    args: argv,
    options: {
      codex: { type: "string" },
      config: { type: "string" },
      relay: { type: "string" },
      web: { type: "string" },
      "prevent-sleep": { type: "boolean" },
    },
  });
  if (positionals.length > 3) {
    throw new Error(
      "位置参数过多。兼容形式只接受：<codex> <relay> <web>。",
    );
  }

  const [positionalCodex, positionalRelay, positionalWeb] = positionals;
  const codexArg = values.codex ?? positionalCodex;

  const codex = codexArg
    ? resolveCodexCommand({
        env: { ...(env ?? {}), CODEX_REMOTE_CODEX: codexArg },
        exists,
        platform,
      })
    : (resolveCodex
        ? resolveCodex()
        : resolveCodexCommand({ env, exists, platform }));

  return {
    configPath: values.config,
    codexSource: codexArg ? "arg" : codex.source,
    overrides: {
      codexCommand: codex.command,
      relayUrl: values.relay ?? positionalRelay,
      webUrl: values.web ?? positionalWeb,
      preventSleep: values["prevent-sleep"],
    },
  };
}
