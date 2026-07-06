#!/usr/bin/env node
import process from "node:process";

import {
  buildPagesDeployCommand,
  buildWorkerDeployCommand,
  runCloudflareDeploy,
} from "../src/deploy/cloudflare.mjs";

const argv = process.argv.slice(2);
const workerStatus = runCloudflareDeploy(buildWorkerDeployCommand());
if (workerStatus !== 0) process.exit(workerStatus);

process.exit(runCloudflareDeploy(buildPagesDeployCommand({ argv })));
