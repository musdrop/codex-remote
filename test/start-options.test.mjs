import assert from "node:assert/strict";
import test from "node:test";

import { buildStartDaemonOptions } from "../src/desktop/start-options.mjs";

test("buildStartDaemonOptions resolves codex and keeps relay/web overrides", () => {
  const options = buildStartDaemonOptions({
    argv: [
      "--config",
      "D:\\State\\daemon.json",
      "--relay",
      "wss://relay.example.com",
      "--web",
      "https://remote.example.com/",
    ],
    resolveCodex: () => ({ command: "D:\\Codex\\codex.exe", source: "path" }),
  });

  assert.deepEqual(options, {
    configPath: "D:\\State\\daemon.json",
    codexSource: "path",
    overrides: {
      codexCommand: "D:\\Codex\\codex.exe",
      relayUrl: "wss://relay.example.com",
      webUrl: "https://remote.example.com/",
      preventSleep: undefined,
    },
  });
});

test("buildStartDaemonOptions lets --codex override discovery", () => {
  const options = buildStartDaemonOptions({
    argv: ["--codex", "D:\\Manual\\codex.exe"],
    exists: (candidate) => candidate === "D:\\Manual\\codex.exe",
    env: { PATH: "" },
    platform: "win32",
    validate: (candidate) => ({ ok: candidate === "D:\\Manual\\codex.exe" }),
  });

  assert.equal(options.overrides.codexCommand, "D:\\Manual\\codex.exe");
  assert.equal(options.codexSource, "arg");
});

test("buildStartDaemonOptions accepts npm-stripped positional codex relay and web args", () => {
  const options = buildStartDaemonOptions({
    argv: [
      "E:\\WindowsApps\\OpenAICodex\\app\\Codex.exe",
      "ws://127.0.0.1:8787",
      "http://127.0.0.1:4173/",
    ],
    exists: (candidate) => candidate === "E:\\WindowsApps\\OpenAICodex\\app\\Codex.exe",
    env: { PATH: "" },
    platform: "win32",
    validate: (candidate) => ({ ok: candidate === "E:\\WindowsApps\\OpenAICodex\\app\\Codex.exe" }),
  });

  assert.deepEqual(options.overrides, {
    codexCommand: "E:\\WindowsApps\\OpenAICodex\\app\\Codex.exe",
    relayUrl: "ws://127.0.0.1:8787",
    webUrl: "http://127.0.0.1:4173/",
    preventSleep: undefined,
  });
  assert.equal(options.codexSource, "arg");
});

test("buildStartDaemonOptions maps --no-prevent-sleep to false", () => {
  const options = buildStartDaemonOptions({
    argv: ["--no-prevent-sleep"],
    resolveCodex: () => ({ command: "codex", source: "path" }),
  });

  assert.equal(options.overrides.preventSleep, false);
});
