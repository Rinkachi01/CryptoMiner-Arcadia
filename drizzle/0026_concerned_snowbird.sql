ALTER TABLE `account_network_power` ADD `allocation_ltc` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `network_runtime_settings` ADD `base_ltc_gh` integer DEFAULT 2500000 NOT NULL;--> statement-breakpoint
ALTER TABLE `network_runtime_settings` ADD `reward_ltc_atomic` integer DEFAULT 5000 NOT NULL;