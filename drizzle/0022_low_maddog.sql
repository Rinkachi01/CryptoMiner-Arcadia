CREATE TABLE `wallet_withdrawal_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`asset` text NOT NULL,
	`provider` text NOT NULL,
	`requested_atomic` integer NOT NULL,
	`destination_preview` text NOT NULL,
	`status` text DEFAULT 'simulation_only' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wallet_withdrawal_intents_account_created_idx` ON `wallet_withdrawal_intents` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `wallet_withdrawal_intents_status_created_idx` ON `wallet_withdrawal_intents` (`status`,`created_at`);