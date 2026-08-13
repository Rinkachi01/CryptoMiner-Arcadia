CREATE TABLE `season_pass_max` (
	`season_id` text NOT NULL,
	`account_id` text NOT NULL,
	`cma_paid_micros` integer NOT NULL,
	`purchased_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `season_pass_max_season_account_unique` ON `season_pass_max` (`season_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `season_pass_max_account_idx` ON `season_pass_max` (`account_id`);