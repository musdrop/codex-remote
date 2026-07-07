#!/usr/bin/env node
import process from "node:process";

import { buildPagesDeployCommand, runCloudflareDeploy } from "./lib/deploy/cloudflare.mjs";

const command = buildPagesDeployCommand({ argv: process.argv.slice(2) });
process.exit(runCloudflareDeploy(command));
