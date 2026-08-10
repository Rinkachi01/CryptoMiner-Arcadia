CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`account_id` text NOT NULL,
	`email` text NOT NULL,
	`category` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`delivery_status` text DEFAULT 'configuration_pending' NOT NULL,
	`provider_message_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `support_tickets_public_id_unique` ON `support_tickets` (`public_id`);--> statement-breakpoint
CREATE INDEX `support_tickets_account_created_idx` ON `support_tickets` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_tickets_status_created_idx` ON `support_tickets` (`status`,`created_at`);