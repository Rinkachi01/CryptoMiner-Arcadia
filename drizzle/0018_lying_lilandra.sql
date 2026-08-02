CREATE TABLE `player_wallet_accounts` (
	`account_id` text PRIMARY KEY NOT NULL,
	`ledger_model` text DEFAULT 'individual' NOT NULL,
	`custody_mode` text DEFAULT 'provider_invoice' NOT NULL,
	`deposit_status` text DEFAULT 'awaiting_provider' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `player_wallet_accounts_deposit_status_idx` ON `player_wallet_accounts` (`deposit_status`);--> statement-breakpoint
CREATE TABLE `wallet_deposit_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`asset` text NOT NULL,
	`provider` text NOT NULL,
	`provider_reference` text,
	`checkout_url` text,
	`deposit_address` text,
	`requested_usd_micros` integer NOT NULL,
	`received_atomic` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'awaiting_provider' NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wallet_deposit_intents_account_created_idx` ON `wallet_deposit_intents` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `wallet_deposit_intents_provider_reference_idx` ON `wallet_deposit_intents` (`provider`,`provider_reference`);--> statement-breakpoint
CREATE INDEX `wallet_deposit_intents_status_expiry_idx` ON `wallet_deposit_intents` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `wallet_provider_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`deposit_intent_id` text,
	`payload_hash` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_provider_events_provider_event_unique` ON `wallet_provider_events` (`provider`,`provider_event_id`);--> statement-breakpoint
CREATE INDEX `wallet_provider_events_intent_created_idx` ON `wallet_provider_events` (`deposit_intent_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `conversion_quotes` ADD `consumption_key` text;--> statement-breakpoint
ALTER TABLE `conversion_quotes` ADD `consumed_at` integer;--> statement-breakpoint
ALTER TABLE `conversion_quotes` ADD `state_version` integer;