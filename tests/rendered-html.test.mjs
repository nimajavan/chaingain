import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { migrate } from "../dist/services/server/database.js";

test("Linux production server renders HTML, assets and prelaunch API without Cloudflare", { timeout: 60_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "chaingain-http-"));
  const database = join(directory, "test.sqlite");
  migrate(database);
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "0"], {
    env: { ...process.env, NODE_ENV: "production", DATABASE_PATH: database, TRON_NETWORK: "nile", TRON_LOTTERY_ADDRESS: "", SALES_ENABLED: "false" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  try {
    let base;
    for (let attempt = 0; attempt < 200; attempt++) {
      assert.equal(child.exitCode, null, output);
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match && /Ready in/.test(output)) { base = match[0]; break; }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(base, output);
    const response = await fetch(base);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    const html = await response.text();
    assert.match(html, /LottoChain/);
    const css = html.match(/href="([^"]+\.css[^"]*)"/);
    assert.ok(css, "CSS asset missing");
    assert.equal((await fetch(new URL(css[1].replaceAll("&amp;", "&"), base))).status, 200);
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, "prelaunch");
    assert.equal((await fetch(`${base}/api/health`, { method: "POST" })).status, 405);
  } finally {
    if (child.exitCode === null) { const closed = once(child, "exit"); child.kill(); await closed; }
    await rm(directory, { recursive: true, force: true });
  }
});
