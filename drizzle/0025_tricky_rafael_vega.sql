CREATE TABLE `wallet_pix_deposit_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_reference` text,
	`cma_units` integer NOT NULL,
	`brl_cents` integer NOT NULL,
	`usd_brl_micros` integer NOT NULL,
	`margin_bps` integer NOT NULL,
	`status` text DEFAULT 'creating' NOT NULL,
	`ticket_url` text,
	`qr_code` text,
	`credited_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_pix_deposit_provider_reference_unique` ON `wallet_pix_deposit_intents` (`provider_reference`);--> statement-breakpoint
CREATE INDEX `wallet_pix_deposit_account_created_idx` ON `wallet_pix_deposit_intents` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `wallet_pix_deposit_status_expiry_idx` ON `wallet_pix_deposit_intents` (`status`,`expires_at`);