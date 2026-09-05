import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalDatabase, migrate, backupDatabase } from "../dist/services/server/database.js";
import { runIndexer } from "../dist/services/server/cli.js";
import { handleApi } from "../dist/services/worker/api.js";

const address = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";
const config = { TRON_NETWORK: "nile", TRON_LOTTERY_ADDRESS: address };
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "chaingain-db-"));
  const path = join(directory, "db.sqlite");
  migrate(path); migrate(path);
  const db = new LocalDatabase(path);
  t.after(() => { db.close(); rmSync(directory, { recursive: true, force: true }); });
  return { db, path, directory };
}
const event = (name, index, result) => ({ event_name: name, event_index: index, transaction_id: `tx-${index}`, block_number: index + 1, block_timestamp: 1000 + index, result });

test("migrations are repeatable; batch failures roll back; backups are restorable", async (t) => {
  const { db, directory } = fixture(t);
  await assert.rejects(db.batch([db.prepare("INSERT INTO indexer_state VALUES('x','y',0)"), db.prepare("INSERT INTO missing VALUES(1)")]));
  assert.equal(await db.prepare("SELECT * FROM indexer_state WHERE key='x'").first(), null);
  await db.prepare("INSERT INTO indexer_state VALUES('persist','yes',0)").run();
  const target = join(directory, "backup.sqlite");
  await backupDatabase(join(directory, "db.sqlite"), target);
  const restored = new LocalDatabase(target, true);
  try { assert.equal((await restored.prepare("SELECT value FROM indexer_state WHERE key='persist'").first()).value, "yes"); }
  finally { restored.close(); }
  await assert.rejects(backupDatabase(join(directory, "db.sqlite"), target), /exists/);
});

test("indexer is idempotent, preserves uint256 amounts, gates sales and binds database identity", async (t) => {
  const { db } = fixture(t);
  const amount = "184467440737095516160";
  const data = [event("DrawOpened", 0, { drawId: "1", openedAt: "1", closesAt: "10" }),
    event("TicketsPurchased", 1, { drawId: "1", buyer: address, quantity: "2", amount })];
  t.mock.method(globalThis, "fetch", async () => Response.json({ data }));
  assert.equal((await runIndexer(db, config)).indexed, 2);
  assert.equal((await runIndexer(db, config)).indexed, 0);
  assert.equal((await db.prepare("SELECT pool_atomic FROM draws").first()).pool_atomic, amount);
  const health = await handleApi(new Request("http://localhost/api/health"), { ...config, DB: db });
  assert.equal((await health.json()).salesEnabled, false);
  await db.prepare("UPDATE indexer_state SET value='1' WHERE key='last_success_at'").run();
  const stale = await handleApi(new Request("http://localhost/api/health"), { ...config, DB: db, SALES_ENABLED: "true" });
  assert.equal((await stale.json()).status, "syncing");
  await assert.rejects(runIndexer(db, { ...config, TRON_NETWORK: "mainnet" }), /another network/);
});

test("busy lease prevents concurrent indexing and failure releases lease", async (t) => {
  const { db } = fixture(t);
  await db.prepare("INSERT INTO indexer_state VALUES('linux_lease','other',?)").bind(Date.now()).run();
  t.mock.method(globalThis, "fetch", async () => { throw new Error("network down"); });
  assert.equal((await runIndexer(db, config)).status, "busy");
  await db.prepare("DELETE FROM indexer_state WHERE key='linux_lease'").run();
  await assert.rejects(runIndexer(db, config), /network down/);
  assert.equal(await db.prepare("SELECT * FROM indexer_state WHERE key='linux_lease'").first(), null);
});

test("pagination cursor survives the page budget and resumes before declaring readiness", async (t) => {
  const { db } = fixture(t);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    calls++;
    if (calls === 21) assert.equal(url.searchParams.get("fingerprint"), "page-20");
    return Response.json({ data: [event("Ignored", calls, {})], meta: calls <= 20 ? { fingerprint: `page-${calls}` } : {} });
  });
  assert.equal((await runIndexer(db, config)).status, "catching_up");
  assert.equal(await db.prepare("SELECT * FROM indexer_state WHERE key='last_success_at'").first(), null);
  assert.equal((await runIndexer(db, config)).status, "ready");
  assert.equal(await db.prepare("SELECT * FROM indexer_state WHERE key='page_cursor'").first(), null);
});

test("web connection is read-only and unknown chain identity fails closed", async (t) => {
  const { path } = fixture(t);
  const reader = new LocalDatabase(path, true);
  try {
    await assert.rejects(reader.prepare("INSERT INTO indexer_state VALUES('bad','write',0)").run(), /readonly/i);
    const response = await handleApi(new Request("http://localhost/api/health"), { ...config, DB: reader, SALES_ENABLED: "true" });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).salesEnabled, false);
  } finally { reader.close(); }
});

test("missing event identity and malformed upstream responses never mark indexer ready", async (t) => {
  const { db } = fixture(t);
  const missingIndex = event("DrawOpened", 0, { drawId: "1", openedAt: "1", closesAt: "10" });
  delete missingIndex.event_index;
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ data: [missingIndex] }));
  await assert.rejects(runIndexer(db, config), /event_index/);
  mock.mock.mockImplementation(async () => Response.json({ error: "bad response" }));
  await assert.rejects(runIndexer(db, config), /Malformed/);
  assert.equal(await db.prepare("SELECT * FROM indexer_state WHERE key='last_success_at'").first(), null);
});
