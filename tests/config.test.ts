import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { clearConfig, configPath, readStoredConfig, resolveConfig, saveConfig } from "../src/config.js";

test("config read/write uses XDG_CONFIG_HOME", async () => {
  const original = process.env.XDG_CONFIG_HOME;
  const dir = await mkdtemp(join(tmpdir(), "tmh-config-"));
  process.env.XDG_CONFIG_HOME = dir;

  try {
    await saveConfig({ apiKey: "sk-test", baseUrl: "http://localhost:5173/" });
    assert.equal(configPath(), join(dir, "tempmailhush", "config.json"));

    const stored = await readStoredConfig();
    assert.equal(stored.apiKey, "sk-test");
    assert.equal(stored.baseUrl, "http://localhost:5173/");

    const resolved = await resolveConfig();
    assert.equal(resolved.baseUrl, "http://localhost:5173");
    assert.equal(resolved.apiKey, "sk-test");

    await clearConfig();
    assert.deepEqual(await readStoredConfig(), {});
  } finally {
    if (original === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = original;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
