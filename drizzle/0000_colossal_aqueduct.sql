CREATE TABLE `game_states` (
	`account_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`state_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_states_email_unique` ON `game_states` (`email`);--> statement-breakpoint
CREATE INDEX `game_states_updated_at_idx` ON `game_states` (`updated_at`);--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`action` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`state_version` integer NOT NULL,
	`delta_cma_micros` integer DEFAULT 0 NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_entries_idempotency_unique` ON `ledger_entries` (`account_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `ledger_entries_account_created_idx` ON `ledger_entries` (`account_id`,`created_at`);