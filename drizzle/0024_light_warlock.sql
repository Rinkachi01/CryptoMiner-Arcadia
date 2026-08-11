ALTER TABLE `wallet_withdrawal_intents` ADD `destination_address` text;--> statement-breakpoint
ALTER TABLE `wallet_withdrawal_intents` ADD `review_note` text;--> statement-breakpoint
ALTER TABLE `wallet_withdrawal_intents` ADD `transaction_hash` text;--> statement-breakpoint
ALTER TABLE `wallet_withdrawal_intents` ADD `resolved_at` integer;--> statement-breakpoint
ALTER TABLE `wallet_withdrawal_intents` ADD `resolved_by` text;