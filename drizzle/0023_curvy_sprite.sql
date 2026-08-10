ALTER TABLE `wallet_deposit_intents` ADD `settlement_asset` text;--> statement-breakpoint
ALTER TABLE `wallet_deposit_intents` ADD `settlement_atomic` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `wallet_deposit_intents` ADD `credited_cma_micros` integer DEFAULT 0 NOT NULL;