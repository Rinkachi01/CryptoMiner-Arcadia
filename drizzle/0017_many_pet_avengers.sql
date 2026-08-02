CREATE TABLE `conversion_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`asset` text NOT NULL,
	`asset_amount_atomic` integer NOT NULL,
	`usd_rate_micros` integer NOT NULL,
	`gross_cma_micros` integer NOT NULL,
	`fee_bps` integer NOT NULL,
	`fee_cma_micros` integer NOT NULL,
	`net_cma_micros` integer NOT NULL,
	`status` text DEFAULT 'preview' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `conversion_quotes_account_created_idx` ON `conversion_quotes` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `conversion_quotes_status_expiry_idx` ON `conversion_quotes` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `market_price_snapshots` (
	`asset` text PRIMARY KEY NOT NULL,
	`usd_price_micros` integer NOT NULL,
	`provider` text NOT NULL,
	`observed_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `market_price_snapshots_observed_idx` ON `market_price_snapshots` (`observed_at`);