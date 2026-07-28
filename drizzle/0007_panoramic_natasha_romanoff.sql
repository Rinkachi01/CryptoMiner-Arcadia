CREATE TABLE `season_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`metrics_json` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `season_snapshots_season_created_idx` ON `season_snapshots` (`season_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`closed_at` integer
);
--> statement-breakpoint
CREATE INDEX `seasons_status_ends_at_idx` ON `seasons` (`status`,`ends_at`);--> statement-breakpoint
CREATE INDEX `seasons_created_at_idx` ON `seasons` (`created_at`);