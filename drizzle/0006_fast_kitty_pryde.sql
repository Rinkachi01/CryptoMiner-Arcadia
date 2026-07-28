ALTER TABLE `admin_runtime_settings` ADD `power_alert_gh` integer DEFAULT 4000 NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_runtime_settings` ADD `open_review_alert_count` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_runtime_settings` ADD `crate_alert_count` integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_runtime_settings` ADD `miner_concentration_alert_percent` integer DEFAULT 45 NOT NULL;