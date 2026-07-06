import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";

import { findAvailablePort } from "../remote/daemon/src/app-server.mjs";

test("findAvailablePort skips an occupied port", async () => {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const occupied = server.address().port;

  try {
    const available = await findAvailablePort(occupied, { attempts: 5 });
    assert.notEqual(available, occupied);
    assert.ok(available > occupied);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("findAvailablePort returns the requested port when it is free", async () => {
  const available = await findAvailablePort(39171, { attempts: 1 });
  assert.equal(available, 39171);
});
