import { DatabaseSync, backup } from "node:sqlite";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { SqlDatabase, SqlStatement } from "./sql.js";

export class LocalDatabase implements SqlDatabase {
  readonly sqlite: DatabaseSync;
  constructor(path: string, readOnly = false) {
    if (path !== ":memory:" && !existsSync(path)) throw new Error("Database is missing; run db:migrate first");
    this.sqlite = new DatabaseSync(path, { readOnly });
    this.sqlite.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    if (!readOnly) this.sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
  }
  prepare(query: string): LocalStatement { return new LocalStatement(this, query, []); }
  async batch(statements: SqlStatement[]) {
    return this.transaction(() => statements.map((statement) => {
      if (!(statement instanceof LocalStatement) || statement.db !== this) throw new Error("Foreign SQL statement");
      return statement.execute();
    }));
  }
  transaction<T>(fn: () => T): T {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try { const result = fn(); this.sqlite.exec("COMMIT"); return result; }
    catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
  close() { this.sqlite.close(); }
}

class LocalStatement implements SqlStatement {
  constructor(readonly db: LocalDatabase, readonly query: string, readonly values: unknown[]) {}
  bind(...values: unknown[]) { return new LocalStatement(this.db, this.query, values); }
  private parameters() {
    return this.values.map((value) => {
      if (value === null || typeof value === "string" || typeof value === "bigint" ||
        (typeof value === "number" && Number.isFinite(value))) return value;
      throw new Error("Invalid SQL parameter");
    });
  }
  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (this.db.sqlite.prepare(this.query).get(...this.parameters()) as T | undefined) ?? null;
  }
  async all<T = Record<string, unknown>>() {
    return { success: true, results: this.db.sqlite.prepare(this.query).all(...this.parameters()) as T[] };
  }
  execute() { this.db.sqlite.prepare(this.query).run(...this.parameters()); return { success: true }; }
  async run() { return this.execute(); }
}

export function databasePath() {
  const path = process.env.DATABASE_PATH || "./data/chaingain.sqlite";
  if (process.env.NODE_ENV === "production" && !isAbsolute(path)) throw new Error("Production requires an absolute DATABASE_PATH");
  return resolve(path);
}

export function migrate(path: string, directory = resolve("drizzle")) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o750 });
  const seed = new DatabaseSync(path); seed.close();
  const db = new LocalDatabase(path);
  try {
    db.sqlite.exec("CREATE TABLE IF NOT EXISTS linux_migrations(name TEXT PRIMARY KEY, hash TEXT NOT NULL)");
    for (const name of readdirSync(directory).filter((file) => file.endsWith(".sql")).sort()) {
      const sql = readFileSync(join(directory, name), "utf8").replaceAll("\r\n", "\n");
      const hash = createHash("sha256").update(sql).digest("hex");
      db.transaction(() => {
        const previous = db.sqlite.prepare("SELECT hash FROM linux_migrations WHERE name=?").get(name);
        if (previous) {
          if (previous.hash !== hash) throw new Error(`Applied migration changed: ${name}`);
          return;
        }
        db.sqlite.exec(sql);
        db.sqlite.prepare("INSERT INTO linux_migrations(name,hash) VALUES(?,?)").run(name, hash);
      });
    }
  } finally { db.close(); }
}

export async function backupDatabase(path: string, destination: string) {
  if (existsSync(destination)) throw new Error("Backup destination already exists");
  mkdirSync(dirname(destination), { recursive: true, mode: 0o750 });
  const db = new LocalDatabase(path, true);
  try { await backup(db.sqlite, destination); }
  finally { db.close(); }
}
