CREATE TABLE `admin_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_account_id` text NOT NULL,
	`action` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_log_created_at_idx` ON `admin_audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `admin_owners` (
	`singleton_id` integer PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_owners_account_id_unique` ON `admin_owners` (`account_id`);--> statement-breakpoint
CREATE TABLE `admin_runtime_settings` (
	`singleton_id` integer PRIMARY KEY NOT NULL,
	`crates_enabled` integer DEFAULT 1 NOT NULL,
	`minigame_power_enabled` integer DEFAULT 1 NOT NULL,
	`daily_battery_enabled` integer DEFAULT 1 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `admin_session_reviews` (
	`session_id` text PRIMARY KEY NOT NULL,
	`resolution` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`reviewed_by` text NOT NULL,
	`reviewed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_session_reviews_reviewed_at_idx` ON `admin_session_reviews` (`reviewed_at`);