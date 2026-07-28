CREATE TABLE `game_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`game_id` text NOT NULL,
	`nonce` text NOT NULL,
	`seed` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`completed_at` integer,
	`duration_ms` integer,
	`score` integer,
	`reward_power_gh` integer DEFAULT 0 NOT NULL,
	`risk_level` text DEFAULT 'normal' NOT NULL,
	`review_reason` text,
	`proof_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_sessions_nonce_unique` ON `game_sessions` (`nonce`);--> statement-breakpoint
CREATE INDEX `game_sessions_account_started_idx` ON `game_sessions` (`account_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `game_sessions_review_idx` ON `game_sessions` (`risk_level`,`started_at`);--> statement-breakpoint
CREATE TABLE `temporary_power_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`source_session_id` text NOT NULL,
	`power_gh` integer NOT NULL,
	`starts_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `temporary_power_source_unique` ON `temporary_power_grants` (`source_session_id`);--> statement-breakpoint
CREATE INDEX `temporary_power_account_expiry_idx` ON `temporary_power_grants` (`account_id`,`expires_at`);