import { LocalDatabase, databasePath } from "./database.js";
import type { IndexerEnv } from "../worker/indexer.js";

let connection: LocalDatabase | undefined;
export function runtimeEnv(): IndexerEnv {
  // The web process cannot write projections or invoke migrations.
  connection ??= new LocalDatabase(databasePath(), true);
  return {
    DB: connection,
    TRON_NETWORK: process.env.TRON_NETWORK,
    TRON_LOTTERY_ADDRESS: process.env.TRON_LOTTERY_ADDRESS,
    TRON_EVENT_API_BASE: process.env.TRON_EVENT_API_BASE,
    TRONGRID_API_KEY: process.env.TRONGRID_API_KEY,
    SALES_ENABLED: process.env.SALES_ENABLED,
  };
}
