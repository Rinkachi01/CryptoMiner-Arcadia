CREATE TABLE `recovery_archives` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`checksum_sha256` text,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'preparing' NOT NULL,
	`error_message` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recovery_archives_object_key_unique` ON `recovery_archives` (`object_key`);--> statement-breakpoint
CREATE INDEX `recovery_archives_created_at_idx` ON `recovery_archives` (`created_at`);--> statement-breakpoint
CREATE TABLE `recovery_drills` (
	`id` text PRIMARY KEY NOT NULL,
	`archive_id` text NOT NULL,
	`status` text NOT NULL,
	`checks_json` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recovery_drills_created_at_idx` ON `recovery_drills` (`created_at`);--> statement-breakpoint
CREATE INDEX `recovery_drills_archive_idx` ON `recovery_drills` (`archive_id`);