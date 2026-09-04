export interface IndexerEnv {
  DB: D1Database;
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
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return { ready: false as const, reason: "TRON_LOTTERY_ADDRESS is not configured" };
  return { ready: true as const, network, address };
}

function apiBase(env: IndexerEnv, network: string) {
  if (env.TRON_EVENT_API_BASE) return env.TRON_EVENT_API_BASE.replace(/\/$/, "");
  if (network === "nile") return "https://nile.trongrid.io";
  if (network === "shasta") return "https://api.shasta.trongrid.io";
  return "https://api.trongrid.io";
}
const pick = (result: Record<string, string>, ...keys: string[]) => keys.map((key) => result[key]).find((item) => item !== undefined);
const eventIndex = (event: TronEvent) => Number(event.event_index ?? 0);

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
        pool_atomic=CAST((SELECT COALESCE(SUM(CAST(amount_atomic AS INTEGER)),0) FROM purchases WHERE draw_id=?) AS TEXT),
        updated_block=? WHERE draw_id=?`).bind(drawId, drawId, drawId, event.block_number, drawId)];
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
  const exists = await env.DB.prepare("SELECT 1 AS found FROM chain_events WHERE network=? AND transaction_id=? AND event_index=?")
    .bind(network, event.transaction_id, eventIndex(event)).first<{ found: number }>();
  if (exists) return false;
  const insert = env.DB.prepare(`INSERT OR IGNORE INTO chain_events
    (network,contract_address,transaction_id,event_index,event_name,block_number,block_timestamp,result_json,indexed_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(network, address, event.transaction_id, eventIndex(event), event.event_name, event.block_number, event.block_timestamp, JSON.stringify(event.result), Date.now());
  await env.DB.batch([insert, ...projectionStatements(env, event)]);
  return true;
}

export async function syncConfirmedEvents(env: IndexerEnv) {
  const config = validateIndexerConfig(env);
  if (!config.ready) return { status: "prelaunch", indexed: 0, reason: config.reason };
  const checkpoint = await env.DB.prepare("SELECT value FROM indexer_state WHERE key='last_block_timestamp'").first<{ value: string }>();
  const minimumTimestamp = Number(checkpoint?.value ?? "0");
  let maximumTimestamp = minimumTimestamp;
  let fingerprint: string | undefined;
  let indexed = 0;
  for (let page = 0; page < 20; page++) {
    const url = new URL(`${apiBase(env, config.network)}/v1/contracts/${config.address}/events`);
    url.searchParams.set("only_confirmed", "true"); url.searchParams.set("order_by", "block_timestamp,asc"); url.searchParams.set("limit", "200");
    if (minimumTimestamp > 0) url.searchParams.set("min_block_timestamp", String(Math.max(0, minimumTimestamp - 1)));
    if (fingerprint) url.searchParams.set("fingerprint", fingerprint);
    const headers = env.TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": env.TRONGRID_API_KEY } : undefined;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`TronGrid events request failed (${response.status})`);
    const body = await response.json() as TronGridPage;
    for (const event of body.data ?? []) {
      if (await storeEvent(env, config.network, config.address, event)) indexed++;
      maximumTimestamp = Math.max(maximumTimestamp, event.block_timestamp);
    }
    const next = body.meta?.fingerprint;
    if (!next || next === fingerprint || !(body.data?.length)) break;
    fingerprint = next;
  }
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO indexer_state(key,value,updated_at) VALUES('last_success_at',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(String(now), now),
    env.DB.prepare("INSERT INTO indexer_state(key,value,updated_at) VALUES('last_block_timestamp',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(String(maximumTimestamp), now),
  ]);
  return { status: "ready", network: config.network, indexed };
}
