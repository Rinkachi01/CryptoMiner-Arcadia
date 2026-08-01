CREATE TABLE `account_network_power` (
	`account_id` text PRIMARY KEY NOT NULL,
	`installed_power_gh` integer DEFAULT 0 NOT NULL,
	`allocation_cma` integer DEFAULT 100 NOT NULL,
	`allocation_btc` integer DEFAULT 0 NOT NULL,
	`allocation_doge` integer DEFAULT 0 NOT NULL,
	`energy_expires_at` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_network_power_energy_expiry_idx` ON `account_network_power` (`energy_expires_at`);