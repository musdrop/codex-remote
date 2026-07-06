#!/usr/bin/env node
import process from "node:process";

import { startDaemon } from "../remote/daemon/src/main.mjs";
import { defaultConfigPath } from "../remote/daemon/src/config.mjs";
import { buildStartDaemonOptions } from "../src/desktop/start-options.mjs";

async function main() {
  const options = buildStartDaemonOptions({ argv: process.argv.slice(2) });
  const daemon = await startDaemon({
    configPath: options.configPath ?? defaultConfigPath(),
    overrides: options.overrides,
  });

  console.log(`Codex Remote daemon started using Codex Desktop engine (${options.codexSource}): ${options.overrides.codexCommand}`);

  const shutdown = () => {
    daemon.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
