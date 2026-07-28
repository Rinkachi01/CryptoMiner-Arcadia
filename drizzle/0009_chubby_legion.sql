ALTER TABLE `network_runtime_settings` ADD `reward_cma_atomic` integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE `network_runtime_settings` ADD `reward_btc_atomic` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `network_runtime_settings` ADD `reward_doge_atomic` integer DEFAULT 1000000 NOT NULL;--> statement-breakpoint
ALTER TABLE `network_runtime_settings` ADD `reward_bonus_bps` integer DEFAULT 10000 NOT NULL;--> statement-breakpoint
ALTER TABLE `network_runtime_settings` ADD `reward_bonus_ends_at` integer DEFAULT 0 NOT NULL;