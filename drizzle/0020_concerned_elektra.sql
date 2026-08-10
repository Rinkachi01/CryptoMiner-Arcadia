ALTER TABLE `support_tickets` ADD `admin_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `last_reply_at` integer;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `last_reply_by` text;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `reply_delivery_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `reply_provider_message_id` text;