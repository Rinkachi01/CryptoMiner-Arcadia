CREATE TABLE `task_preference_events` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`partner_tasks_mode` text NOT NULL,
	`consent_version` text DEFAULT 'beta-v1' NOT NULL,
	`source` text DEFAULT 'tasks' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_preference_events_account_created_idx` ON `task_preference_events` (`account_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `task_preferences` (
	`account_id` text PRIMARY KEY NOT NULL,
	`partner_tasks_mode` text DEFAULT 'ask' NOT NULL,
	`consent_version` text DEFAULT 'beta-v1' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
