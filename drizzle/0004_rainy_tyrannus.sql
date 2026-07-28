CREATE TABLE `daily_mission_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`mission_id` text NOT NULL,
	`window_key` text NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`battery_reward` integer DEFAULT 1 NOT NULL,
	`state_version_before` integer NOT NULL,
	`state_version_after` integer,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_mission_claims_account_window_unique` ON `daily_mission_claims` (`account_id`,`mission_id`,`window_key`);--> statement-breakpoint
CREATE INDEX `daily_mission_claims_account_created_idx` ON `daily_mission_claims` (`account_id`,`created_at`);