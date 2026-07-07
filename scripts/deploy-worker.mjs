#!/usr/bin/env node
import process from "node:process";

import { buildWorkerDeployCommand, runCloudflareDeploy } from "./lib/deploy/cloudflare.mjs";

const command = buildWorkerDeployCommand({ argv: process.argv.slice(2) });
process.exit(runCloudflareDeploy(command));
