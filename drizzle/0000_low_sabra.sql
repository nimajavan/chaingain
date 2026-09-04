CREATE TABLE `chain_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`network` text NOT NULL,
	`contract_address` text NOT NULL,
	`transaction_id` text NOT NULL,
	`event_index` integer NOT NULL,
	`event_name` text NOT NULL,
	`block_number` integer NOT NULL,
	`block_timestamp` integer NOT NULL,
	`result_json` text NOT NULL,
	`indexed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chain_events_tx_event_uq` ON `chain_events` (`network`,`transaction_id`,`event_index`);--> statement-breakpoint
CREATE INDEX `chain_events_contract_block_idx` ON `chain_events` (`contract_address`,`block_number`);--> statement-breakpoint
CREATE INDEX `chain_events_name_timestamp_idx` ON `chain_events` (`event_name`,`block_timestamp`);--> statement-breakpoint
CREATE TABLE `claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`draw_id` integer NOT NULL,
	`beneficiary` text NOT NULL,
	`recipient` text,
	`amount_atomic` text NOT NULL,
	`transaction_id` text NOT NULL,
	`event_index` integer NOT NULL,
	`block_number` integer NOT NULL,
	`block_timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `claims_tx_event_uq` ON `claims` (`transaction_id`,`event_index`);--> statement-breakpoint
CREATE INDEX `claims_beneficiary_timestamp_idx` ON `claims` (`beneficiary`,`block_timestamp`);--> statement-breakpoint
CREATE TABLE `draws` (
	`draw_id` integer PRIMARY KEY NOT NULL,
	`opened_at` integer,
	`closes_at` integer,
	`state` text NOT NULL,
	`total_tickets` integer DEFAULT 0 NOT NULL,
	`unique_players` integer DEFAULT 0 NOT NULL,
	`pool_atomic` text DEFAULT '0' NOT NULL,
	`request_id` text,
	`winner` text,
	`winner_payout_atomic` text,
	`treasury_payout_atomic` text,
	`random_word` text,
	`settlement_transaction_id` text,
	`updated_block` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `draws_state_id_idx` ON `draws` (`state`,`draw_id`);--> statement-breakpoint
CREATE TABLE `indexer_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draw_id` integer NOT NULL,
	`buyer` text NOT NULL,
	`quantity` integer NOT NULL,
	`amount_atomic` text NOT NULL,
	`transaction_id` text NOT NULL,
	`event_index` integer NOT NULL,
	`block_number` integer NOT NULL,
	`block_timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_tx_event_uq` ON `purchases` (`transaction_id`,`event_index`);--> statement-breakpoint
CREATE INDEX `purchases_draw_timestamp_idx` ON `purchases` (`draw_id`,`block_timestamp`);--> statement-breakpoint
CREATE INDEX `purchases_buyer_timestamp_idx` ON `purchases` (`buyer`,`block_timestamp`);