CREATE TABLE `referral_attributions` (
	`referred_account_id` text PRIMARY KEY NOT NULL,
	`referrer_account_id` text NOT NULL,
	`referral_code` text NOT NULL,
	`status` text DEFAULT 'tracked' NOT NULL,
	`attributed_at` integer NOT NULL,
	`validated_at` integer,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `referral_attributions_referrer_idx` ON `referral_attributions` (`referrer_account_id`,`attributed_at`);--> statement-breakpoint
CREATE TABLE `referral_codes` (
	`account_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_codes_code_unique` ON `referral_codes` (`code`);--> statement-breakpoint
CREATE TABLE `season_daily_logins` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`account_id` text NOT NULL,
	`day_key` text NOT NULL,
	`xp` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `season_daily_logins_unique` ON `season_daily_logins` (`season_id`,`account_id`,`day_key`);--> statement-breakpoint
CREATE INDEX `season_daily_logins_season_account_idx` ON `season_daily_logins` (`season_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `season_passes` (
	`season_id` text NOT NULL,
	`account_id` text NOT NULL,
	`premium_unlocked` integer DEFAULT 0 NOT NULL,
	`cma_paid_micros` integer DEFAULT 0 NOT NULL,
	`purchased_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `season_passes_season_account_unique` ON `season_passes` (`season_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `season_passes_account_idx` ON `season_passes` (`account_id`);--> statement-breakpoint
CREATE TABLE `season_reward_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`account_id` text NOT NULL,
	`level` integer NOT NULL,
	`track` text NOT NULL,
	`reward_json` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`state_version_before` integer NOT NULL,
	`state_version_after` integer NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `season_reward_claims_unique` ON `season_reward_claims` (`season_id`,`account_id`,`track`,`level`);--> statement-breakpoint
CREATE INDEX `season_reward_claims_account_idx` ON `season_reward_claims` (`account_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `seasons` ADD `campaign_slug` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `seasons` ADD `duration_days` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `seasons` ADD `premium_price_cma_micros` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `seasons` ADD `configuration_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX `seasons_campaign_slug_idx` ON `seasons` (`campaign_slug`);