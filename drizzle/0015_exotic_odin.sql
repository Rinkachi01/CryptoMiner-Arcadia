CREATE TABLE `beta_accessibility_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`window_key` text NOT NULL,
	`viewport_bucket` text NOT NULL,
	`input_mode` text NOT NULL,
	`text_scale` text DEFAULT 'comfortable' NOT NULL,
	`text_readable` integer NOT NULL,
	`controls_easy` integer NOT NULL,
	`motion_comfortable` integer NOT NULL,
	`rack_clear` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beta_accessibility_account_window_unique` ON `beta_accessibility_reviews` (`account_id`,`window_key`);--> statement-breakpoint
CREATE INDEX `beta_accessibility_created_at_idx` ON `beta_accessibility_reviews` (`created_at`);--> statement-breakpoint
CREATE TABLE `beta_device_profiles` (
	`account_id` text PRIMARY KEY NOT NULL,
	`first_viewport` text NOT NULL,
	`current_viewport` text NOT NULL,
	`first_input_mode` text NOT NULL,
	`current_input_mode` text NOT NULL,
	`text_scale` text DEFAULT 'comfortable' NOT NULL,
	`onboarding_stage` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
