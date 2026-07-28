CREATE TABLE `game_emission_budgets` (
	`account_id` text NOT NULL,
	`window_key` text NOT NULL,
	`granted_power_gh` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_emission_budgets_account_window_unique` ON `game_emission_budgets` (`account_id`,`window_key`);