CREATE TABLE `operational_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_account_id` text NOT NULL,
	`status` text NOT NULL,
	`metrics_json` text DEFAULT '{}' NOT NULL,
	`findings_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `operational_checkpoints_created_at_idx` ON `operational_checkpoints` (`created_at`);