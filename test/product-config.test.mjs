import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadProductConfig, productConfigPath } from "../src/desktop/product-config.mjs";
import { loadOrCreateConfig } from "../remote/daemon/src/config.mjs";

test("loadProductConfig reads relay and web URLs from installRoot/config/product.json", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-remote-product-"));
  try {
    mkdirSync(join(root, "config"), { recursive: true });
    writeFileSync(
      productConfigPath(root),
      JSON.stringify({
        relayUrl: "wss://relay.example.com",
        webUrl: "https://remote.example.com/",
      }),
    );

    assert.deepEqual(loadProductConfig(root), {
      relayUrl: "wss://relay.example.com",
      webUrl: "https://remote.example.com/",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("loadOrCreateConfig applies product relay and web URLs when creating user config", () => {
  const dir = mkdtempSync(join(tmpdir(), "codex-remote-user-config-"));
  try {
    const config = loadOrCreateConfig(join(dir, "daemon.json"), {
      productConfig: {
        relayUrl: "wss://relay.example.com",
        webUrl: "https://remote.example.com/",
      },
    });

    assert.equal(config.relayUrl, "wss://relay.example.com");
    assert.equal(config.webUrl, "https://remote.example.com/");
    assert.equal(config.codexCommand, "codex");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadOrCreateConfig keeps product relay and web URLs authoritative for existing config", () => {
  const dir = mkdtempSync(join(tmpdir(), "codex-remote-user-config-"));
  try {
    const path = join(dir, "daemon.json");
    const old = loadOrCreateConfig(path);
    old.relayUrl = "ws://127.0.0.1:8787";
    old.webUrl = "http://127.0.0.1:4173/";
    writeFileSync(path, `${JSON.stringify(old, null, 2)}\n`);

    const config = loadOrCreateConfig(path, {
      productConfig: {
        relayUrl: "wss://relay.example.com",
        webUrl: "https://remote.example.com/",
      },
    });

    assert.equal(config.relayUrl, "wss://relay.example.com");
    assert.equal(config.webUrl, "https://remote.example.com/");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
