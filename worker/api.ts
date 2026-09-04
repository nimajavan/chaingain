import { validateIndexerConfig, type IndexerEnv } from "./indexer";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: {
  "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });

export async function handleApi(request: Request, env: IndexerEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const config = validateIndexerConfig(env);
  if (url.pathname === "/api/health") {
    const last = await env.DB.prepare("SELECT value FROM indexer_state WHERE key='last_success_at'").first<{ value: string }>();
    return json({ status: config.ready ? "ready" : "prelaunch", network: config.ready ? config.network : null,
      contractAddress: config.ready ? config.address : null, lastIndexedAt: last ? Number(last.value) : null,
      reason: config.ready ? null : config.reason });
  }
  if (!config.ready) return json({ status: "prelaunch", data: [], reason: config.reason });
  if (url.pathname === "/api/draws") {
    const rows = await env.DB.prepare("SELECT * FROM draws WHERE state='settled' ORDER BY draw_id DESC LIMIT 100").all();
    return json({ status: "ready", data: rows.results ?? [] });
  }
  if (url.pathname === "/api/current") {
    const draw = await env.DB.prepare("SELECT * FROM draws ORDER BY draw_id DESC LIMIT 1").first();
    return json({ status: "ready", data: draw });
  }
  const drawMatch = url.pathname.match(/^\/api\/draws\/(\d+)$/);
  if (drawMatch) {
    const draw = await env.DB.prepare("SELECT * FROM draws WHERE draw_id=?").bind(Number(drawMatch[1])).first();
    return draw ? json({ status: "ready", data: draw }) : json({ error: "not_found" }, 404);
  }
  if (url.pathname === "/api/activity") {
    const rows = await env.DB.prepare("SELECT draw_id,buyer,quantity,amount_atomic,transaction_id,block_timestamp FROM purchases ORDER BY block_timestamp DESC LIMIT 50").all();
    return json({ status: "ready", data: rows.results ?? [] });
  }
  const profileMatch = url.pathname.match(/^\/api\/profile\/(T[1-9A-HJ-NP-Za-km-z]{33})$/);
  if (profileMatch) {
    const address = profileMatch[1];
    const [purchases, claims] = await Promise.all([
      env.DB.prepare("SELECT * FROM purchases WHERE buyer=? ORDER BY block_timestamp DESC LIMIT 100").bind(address).all(),
      env.DB.prepare("SELECT * FROM claims WHERE beneficiary=? ORDER BY block_timestamp DESC LIMIT 100").bind(address).all(),
    ]);
    return json({ status: "ready", data: { purchases: purchases.results ?? [], claims: claims.results ?? [] } });
  }
  return json({ error: "not_found" }, 404);
}
