CREATE TABLE `game_progress` (
	`account_id` text NOT NULL,
	`game_id` text NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`win_streak` integer DEFAULT 0 NOT NULL,
	`next_play_at` integer DEFAULT 0 NOT NULL,
	`total_plays` integer DEFAULT 0 NOT NULL,
	`total_wins` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_progress_account_game_unique` ON `game_progress` (`account_id`,`game_id`);--> statement-breakpoint
CREATE INDEX `game_progress_next_play_idx` ON `game_progress` (`game_id`,`next_play_at`);--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `difficulty` integer DEFAULT 1 NOT NULL;