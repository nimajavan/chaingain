import type { SqlDatabase } from "../server/sql.js";
import { TronWeb } from "tronweb";

export interface IndexerEnv {
  DB: SqlDatabase;
  SALES_ENABLED?: string;
  TRON_NETWORK?: string;
  TRON_LOTTERY_ADDRESS?: string;
  TRONGRID_API_KEY?: string;
  TRON_EVENT_API_BASE?: string;
}

type TronEvent = { event_name: string; block_number: number; block_timestamp: number; transaction_id: string;
  event_index?: number; result: Record<string, string> };
type TronGridPage = { data?: TronEvent[]; meta?: { fingerprint?: string } };
const allowedNetworks = new Set(["nile", "shasta", "mainnet"]);

export function validateIndexerConfig(env: IndexerEnv) {
  const network = (env.TRON_NETWORK || "").toLowerCase();
  const address = env.TRON_LOTTERY_ADDRESS || "";
  if (!allowedNetworks.has(network)) return { ready: false as const, reason: "TRON_NETWORK is not configured" };
  if (!TronWeb.isAddress(address)) return { ready: false as const, reason: "TRON_LOTTERY_ADDRESS is not configured or invalid" };
  return { ready: true as const, network, address };
}

function apiBase(env: IndexerEnv, network: string) {
  const expected = network === "nile" ? "https://nile.trongrid.io" : network === "shasta" ? "https://api.shasta.trongrid.io" : "https://api.trongrid.io";
  if (env.TRON_EVENT_API_BASE && env.TRON_EVENT_API_BASE.replace(/\/$/, "") !== expected) throw new Error("Event API does not match selected network");
  return expected;
}
const pick = (result: Record<string, string>, ...keys: string[]) => keys.map((key) => result[key]).find((item) => item !== undefined);
const eventIndex = (event: TronEvent) => {
  const value = Number(event.event_index);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Missing or invalid event_index");
  return value;
};

function projectionStatements(env: IndexerEnv, event: TronEvent) {
  const result = event.result;
  const drawId = Number(pick(result, "drawId", "draw_id"));
  if (!Number.isSafeInteger(drawId) || drawId < 1) return [];
  switch (event.event_name) {
    case "DrawOpened": return [env.DB.prepare(`INSERT INTO draws (draw_id,opened_at,closes_at,state,updated_block)
      VALUES (?,?,?,'open',?) ON CONFLICT(draw_id) DO UPDATE SET opened_at=excluded.opened_at,
      closes_at=excluded.closes_at,state='open',updated_block=excluded.updated_block WHERE excluded.updated_block>=draws.updated_block`)
      .bind(drawId, Number(pick(result, "openedAt", "opened_at")), Number(pick(result, "closesAt", "closes_at")), event.block_number)];
    case "TicketsPurchased": return [env.DB.prepare(`INSERT OR IGNORE INTO purchases
      (draw_id,buyer,quantity,amount_atomic,transaction_id,event_index,block_number,block_timestamp) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(drawId, pick(result, "buyer"), Number(pick(result, "quantity")), pick(result, "amount"), event.transaction_id, eventIndex(event), event.block_number, event.block_timestamp),
      env.DB.prepare(`UPDATE draws SET
        total_tickets=(SELECT COALESCE(SUM(quantity),0) FROM purchases WHERE draw_id=?),
        unique_players=(SELECT COUNT(DISTINCT buyer) FROM purchases WHERE draw_id=?),
        updated_block=MAX(updated_block,?) WHERE draw_id=?`).bind(drawId, drawId, event.block_number, drawId)];
    case "RandomnessRequested": return [env.DB.prepare("UPDATE draws SET state='randomness_pending',request_id=?,updated_block=? WHERE draw_id=? AND ?>=updated_block")
      .bind(pick(result, "requestId", "request_id"), event.block_number, drawId, event.block_number)];
    case "DrawBecameRefundable": return [env.DB.prepare("UPDATE draws SET state='refundable',unique_players=?,pool_atomic=?,updated_block=? WHERE draw_id=? AND ?>=updated_block")
      .bind(Number(pick(result, "uniquePlayers", "unique_players")), pick(result, "pool"), event.block_number, drawId, event.block_number)];
    case "DrawSettled": return [env.DB.prepare(`UPDATE draws SET state='settled',winner=?,winner_payout_atomic=?,treasury_payout_atomic=?,
      random_word=?,settlement_transaction_id=?,updated_block=? WHERE draw_id=? AND ?>=updated_block`)
      .bind(pick(result, "winner"), pick(result, "winnerPayout", "winner_payout"), pick(result, "treasuryPayout", "treasury_payout"), pick(result, "randomWord", "random_word"), event.transaction_id, event.block_number, drawId, event.block_number)];
    case "RefundClaimed":
    case "PayoutClaimed": return [env.DB.prepare(`INSERT OR IGNORE INTO claims
      (kind,draw_id,beneficiary,recipient,amount_atomic,transaction_id,event_index,block_number,block_timestamp) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(event.event_name === "RefundClaimed" ? "refund" : "payout", drawId, pick(result, "player", "beneficiary"), pick(result, "recipient") ?? null, pick(result, "amount"), event.transaction_id, eventIndex(event), event.block_number, event.block_timestamp)];
    default: return [];
  }
}

async function storeEvent(env: IndexerEnv, network: string, address: string, event: TronEvent) {
  if (!Number.isSafeInteger(event.block_timestamp) || event.block_timestamp < 0 || !Number.isSafeInteger(event.block_number) || event.block_number < 0) throw new Error("Invalid event block metadata");
  event.result = { ...event.result };
  for (const key of ["buyer", "winner", "player", "beneficiary", "recipient"]) {
    const value = event.result[key];
    if (value) {
      const hex = value.replace(/^0x/, "");
      const normalized = /^[a-fA-F0-9]{40}$/.test(hex) ? TronWeb.address.fromHex(`41${hex}`) : /^41[a-fA-F0-9]{40}$/.test(hex) ? TronWeb.address.fromHex(hex) : value;
      if (!TronWeb.isAddress(normalized)) throw new Error("Invalid event address");
      event.result[key] = normalized;
    }
  }
  const exists = await env.DB.prepare("SELECT 1 AS found FROM chain_events WHERE network=? AND transaction_id=? AND event_index=?")
    .bind(network, event.transaction_id, eventIndex(event)).first<{ found: number }>();
  if (exists) return false;
  const insert = env.DB.prepare(`INSERT OR IGNORE INTO chain_events
    (network,contract_address,transaction_id,event_index,event_name,block_number,block_timestamp,result_json,indexed_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(network, address, event.transaction_id, eventIndex(event), event.event_name, event.block_number, event.block_timestamp, JSON.stringify(event.result), Date.now());
  const projections = projectionStatements(env, event);
  if (event.event_name === "TicketsPurchased") {
    const drawId = Number(pick(event.result, "drawId", "draw_id"));
    const rows = await env.DB.prepare("SELECT amount_atomic FROM purchases WHERE draw_id=?").bind(drawId).all<{ amount_atomic: string }>();
    // Never cast uint256 token values to SQLite's signed 64-bit INTEGER.
    const total = (rows.results ?? []).reduce((sum, row) => sum + BigInt(row.amount_atomic), BigInt(event.result.amount));
    projections.push(env.DB.prepare("UPDATE draws SET pool_atomic=? WHERE draw_id=?").bind(total.toString(), drawId));
  }
  await env.DB.batch([insert, ...projections]);
  return true;
}

export async function syncConfirmedEvents(env: IndexerEnv, renewLease: () => void = () => {}) {
  const config = validateIndexerConfig(env);
  if (!config.ready) return { status: "prelaunch", indexed: 0, reason: config.reason };
  const checkpoint = await env.DB.prepare("SELECT value FROM indexer_state WHERE key='last_block_timestamp'").first<{ value: string }>();
  const cursor = await env.DB.prepare("SELECT value FROM indexer_state WHERE key='page_cursor'").first<{ value: string }>();
  const saved = cursor ? JSON.parse(cursor.value) as { minimumTimestamp: number; fingerprint: string; maximumTimestamp: number } : null;
  const minimumTimestamp = saved?.minimumTimestamp ?? Number(checkpoint?.value ?? "0");
  let maximumTimestamp = minimumTimestamp;
  maximumTimestamp = saved?.maximumTimestamp ?? maximumTimestamp;
  let fingerprint: string | undefined = saved?.fingerprint;
  let indexed = 0;
  for (let page = 0; page < 20; page++) {
    renewLease();
    const url = new URL(`${apiBase(env, config.network)}/v1/contracts/${config.address}/events`);
    url.searchParams.set("only_confirmed", "true"); url.searchParams.set("order_by", "block_timestamp,asc"); url.searchParams.set("limit", "200");
    if (minimumTimestamp > 0) url.searchParams.set("min_block_timestamp", String(Math.max(0, minimumTimestamp - 1)));
    if (fingerprint) url.searchParams.set("fingerprint", fingerprint);
    const headers = env.TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": env.TRONGRID_API_KEY } : undefined;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`TronGrid events request failed (${response.status})`);
    const body = await response.json() as TronGridPage;
    if (!Array.isArray(body.data)) throw new Error("Malformed TronGrid events response");
    renewLease();
    for (const event of body.data ?? []) {
      if (await storeEvent(env, config.network, config.address, event)) indexed++;
      maximumTimestamp = Math.max(maximumTimestamp, event.block_timestamp);
    }
    const next = body.meta?.fingerprint;
    if (next && (next === fingerprint || !body.data.length)) throw new Error("TronGrid pagination did not advance");
    const pageTime = Date.now();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO indexer_state(key,value,updated_at) VALUES('last_block_timestamp',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(String(maximumTimestamp), pageTime),
      next ? env.DB.prepare("INSERT INTO indexer_state(key,value,updated_at) VALUES('page_cursor',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(JSON.stringify({ minimumTimestamp, maximumTimestamp, fingerprint: next }), pageTime)
        : env.DB.prepare("DELETE FROM indexer_state WHERE key='page_cursor'"),
    ]);
    if (!next) { fingerprint = undefined; break; }
    fingerprint = next;
  }
  if (fingerprint) return { status: "catching_up", network: config.network, indexed };
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO indexer_state(key,value,updated_at) VALUES('last_success_at',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(String(now), now),
    env.DB.prepare("INSERT INTO indexer_state(key,value,updated_at) VALUES('last_block_timestamp',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(String(maximumTimestamp), now),
  ]);
  return { status: "ready", network: config.network, indexed };
}
