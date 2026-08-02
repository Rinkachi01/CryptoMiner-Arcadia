CREATE TABLE `arcade_security_passes` (
	`account_id` text PRIMARY KEY NOT NULL,
	`verified_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `arcade_security_passes_expiry_idx` ON `arcade_security_passes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`category` text NOT NULL,
	`reason` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `security_events_created_at_idx` ON `security_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `security_events_account_created_idx` ON `security_events` (`account_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `security_rate_windows` (
	`account_id` text NOT NULL,
	`action` text NOT NULL,
	`window_key` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `security_rate_window_unique` ON `security_rate_windows` (`account_id`,`action`,`window_key`);--> statement-breakpoint
CREATE INDEX `security_rate_windows_expiry_idx` ON `security_rate_windows` (`expires_at`);