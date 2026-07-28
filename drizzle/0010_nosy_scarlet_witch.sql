CREATE TABLE `beta_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`category` text NOT NULL,
	`rating` integer NOT NULL,
	`message` text NOT NULL,
	`page` text DEFAULT 'tasks' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `beta_feedback_account_created_idx` ON `beta_feedback` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `beta_feedback_created_at_idx` ON `beta_feedback` (`created_at`);