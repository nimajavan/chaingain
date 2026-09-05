import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { LocalDatabase, databasePath, migrate, backupDatabase } from "./database.js";
import { syncConfirmedEvents, validateIndexerConfig, type IndexerEnv } from "../worker/indexer.js";

export async function runIndexer(db: LocalDatabase, config: Omit<IndexerEnv, "DB">) {
  const env = { ...config, DB: db };
  const valid = validateIndexerConfig(env);
  if (!valid.ready) throw new Error(valid.reason);
  const owner = randomUUID();
  const acquired = db.transaction(() => {
    const lease = db.sqlite.prepare("SELECT value,updated_at FROM indexer_state WHERE key='linux_lease'").get();
    if (lease && Number(lease.updated_at) > Date.now() - 120_000) return false;
    const identity = `${valid.network}:${valid.address}`;
    const previous = db.sqlite.prepare("SELECT value FROM indexer_state WHERE key='chain_identity'").get();
    if (previous && previous.value !== identity) throw new Error("Database belongs to another network/contract; use a separate DATABASE_PATH");
    if (!previous && Number(db.sqlite.prepare("SELECT COUNT(*) AS n FROM chain_events").get()?.n) > 0) throw new Error("Unbound database contains events; explicit migration is required");
    db.sqlite.prepare("INSERT OR IGNORE INTO indexer_state(key,value,updated_at) VALUES('chain_identity',?,?)").run(identity, Date.now());
    db.sqlite.prepare("INSERT INTO indexer_state(key,value,updated_at) VALUES('linux_lease',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").run(owner, Date.now());
    return true;
  });
  if (!acquired) return { status: "busy", indexed: 0 };
  const renew = () => {
    const result = db.sqlite.prepare("UPDATE indexer_state SET updated_at=? WHERE key='linux_lease' AND value=? AND updated_at>?").run(Date.now(), owner, Date.now() - 120_000);
    if (result.changes !== 1) throw new Error("Indexer lease lost");
  };
  try { return await syncConfirmedEvents(env, renew); }
  finally { db.sqlite.prepare("DELETE FROM indexer_state WHERE key='linux_lease' AND value=?").run(owner); }
}

async function main() {
  const path = databasePath();
  const command = process.argv[2];
  if (command === "migrate") { migrate(path); return { status: "migrated" }; }
  if (command === "backup") {
    if (!process.argv[3]) throw new Error("Supply a new backup destination path");
    await backupDatabase(path, resolve(process.argv[3])); return { status: "backed_up" };
  }
  if (command !== "index") throw new Error("Expected migrate, backup, or index");
  const db = new LocalDatabase(path);
  try { return await runIndexer(db, {
    TRON_NETWORK: process.env.TRON_NETWORK,
    TRON_LOTTERY_ADDRESS: process.env.TRON_LOTTERY_ADDRESS,
    TRON_EVENT_API_BASE: process.env.TRON_EVENT_API_BASE,
    TRONGRID_API_KEY: process.env.TRONGRID_API_KEY,
  }); }
  finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((result) => console.log(JSON.stringify(result))).catch((error) => {
    console.error(error instanceof Error ? error.message : "Service failed"); process.exitCode = 1;
  });
}
