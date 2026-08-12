CREATE TABLE `wallet_brl_rate_snapshots` (
	`asset` text PRIMARY KEY NOT NULL,
	`brl_price_micros` integer NOT NULL,
	`observed_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wallet_brl_withdrawal_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`source_asset` text NOT NULL,
	`source_atomic` integer NOT NULL,
	`brl_price_micros` integer NOT NULL,
	`gross_brl_cents` integer NOT NULL,
	`fee_bps` integer NOT NULL,
	`net_brl_cents` integer NOT NULL,
	`status` text DEFAULT 'preview' NOT NULL,
	`consumed_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wallet_brl_withdrawal_quotes_account_created_idx` ON `wallet_brl_withdrawal_quotes` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `wallet_brl_withdrawal_quotes_status_expiry_idx` ON `wallet_brl_withdrawal_quotes` (`status`,`expires_at`);--> statement-breakpoint
ALTER TABLE `wallet_withdrawal_intents` ADD `payout_brl_cents` integer DEFAULT 0 NOT NULL;