CREATE TABLE `network_runtime_settings` (
	`singleton_id` integer PRIMARY KEY NOT NULL,
	`base_cma_gh` integer DEFAULT 60000000 NOT NULL,
	`base_btc_gh` integer DEFAULT 1800000 NOT NULL,
	`base_doge_gh` integer DEFAULT 4000000 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	`updated_by` text
);
