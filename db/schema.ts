import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const chainEvents = sqliteTable("chain_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  network: text("network").notNull(),
  contractAddress: text("contract_address").notNull(),
  transactionId: text("transaction_id").notNull(),
  eventIndex: integer("event_index").notNull(),
  eventName: text("event_name").notNull(),
  blockNumber: integer("block_number").notNull(),
  blockTimestamp: integer("block_timestamp").notNull(),
  resultJson: text("result_json").notNull(),
  indexedAt: integer("indexed_at").notNull(),
}, (table) => [
  uniqueIndex("chain_events_tx_event_uq").on(table.network, table.transactionId, table.eventIndex),
  index("chain_events_contract_block_idx").on(table.contractAddress, table.blockNumber),
  index("chain_events_name_timestamp_idx").on(table.eventName, table.blockTimestamp),
]);

export const draws = sqliteTable("draws", {
  drawId: integer("draw_id").primaryKey(),
  openedAt: integer("opened_at"),
  closesAt: integer("closes_at"),
  state: text("state").notNull(),
  totalTickets: integer("total_tickets").notNull().default(0),
  uniquePlayers: integer("unique_players").notNull().default(0),
  poolAtomic: text("pool_atomic").notNull().default("0"),
  requestId: text("request_id"),
  winner: text("winner"),
  winnerPayoutAtomic: text("winner_payout_atomic"),
  treasuryPayoutAtomic: text("treasury_payout_atomic"),
  randomWord: text("random_word"),
  settlementTransactionId: text("settlement_transaction_id"),
  updatedBlock: integer("updated_block").notNull(),
}, (table) => [index("draws_state_id_idx").on(table.state, table.drawId)]);

export const purchases = sqliteTable("purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }), drawId: integer("draw_id").notNull(),
  buyer: text("buyer").notNull(), quantity: integer("quantity").notNull(),
  amountAtomic: text("amount_atomic").notNull(), transactionId: text("transaction_id").notNull(),
  eventIndex: integer("event_index").notNull(), blockNumber: integer("block_number").notNull(),
  blockTimestamp: integer("block_timestamp").notNull(),
}, (table) => [
  uniqueIndex("purchases_tx_event_uq").on(table.transactionId, table.eventIndex),
  index("purchases_draw_timestamp_idx").on(table.drawId, table.blockTimestamp),
  index("purchases_buyer_timestamp_idx").on(table.buyer, table.blockTimestamp),
]);

export const claims = sqliteTable("claims", {
  id: integer("id").primaryKey({ autoIncrement: true }), kind: text("kind").notNull(),
  drawId: integer("draw_id").notNull(), beneficiary: text("beneficiary").notNull(), recipient: text("recipient"),
  amountAtomic: text("amount_atomic").notNull(), transactionId: text("transaction_id").notNull(),
  eventIndex: integer("event_index").notNull(), blockNumber: integer("block_number").notNull(),
  blockTimestamp: integer("block_timestamp").notNull(),
}, (table) => [
  uniqueIndex("claims_tx_event_uq").on(table.transactionId, table.eventIndex),
  index("claims_beneficiary_timestamp_idx").on(table.beneficiary, table.blockTimestamp),
]);

export const indexerState = sqliteTable("indexer_state", {
  key: text("key").primaryKey(), value: text("value").notNull(), updatedAt: integer("updated_at").notNull(),
});
