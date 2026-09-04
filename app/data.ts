// TRON contract constants, indexed API types, and BigInt-safe USDT formatting.
export const TICKET_PRICE = 10_000_000n;
export const TREASURY_BPS = 3_000n;
export const MIN_PLAYERS = 500;
export const MAX_TICKETS_PER_USER = 100;
export type IndexedDraw = {
  draw_id: number; opened_at: number | null; closes_at: number | null; state: string;
  total_tickets: number; unique_players: number; pool_atomic: string; request_id: string | null;
  winner: string | null; winner_payout_atomic: string | null; treasury_payout_atomic: string | null;
  random_word: string | null; settlement_transaction_id: string | null;
};

export type IndexedActivity = {
  draw_id: number;
  buyer: string;
  quantity: number;
  amount_atomic: string;
  transaction_id: string;
  block_timestamp: number;
};

export const TRON_USDT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const LOTTERY_CONTRACT_PENDING = "Awaiting audited TRON contract";

export async function loadApi<T>(path: string): Promise<T | null> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return null;
  const body = await response.json() as { status?: string; data?: T };
  return body.status === "ready" ? body.data ?? null : null;
}

export function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function formatUsdt(amount: bigint, showSymbol = false): string {
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimal = fraction === "00" ? "" : `.${fraction.replace(/0$/, "")}`;
  return `${showSymbol ? "$" : ""}${grouped}${decimal}`;
}

export function shortAddress(address: string): string {
  return address.length > 13 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
