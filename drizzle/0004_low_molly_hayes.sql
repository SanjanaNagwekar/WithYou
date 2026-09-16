CREATE TABLE `voice_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`voice_id` text NOT NULL,
	`language` text NOT NULL,
	`provider_voice_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_voice_variants_owner_voice` ON `voice_variants` (`owner`,`voice_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `voice_variants_voice_language_unique` ON `voice_variants` (`voice_id`,`language`);--> statement-breakpoint
ALTER TABLE `recordings` ADD `source_transcript` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `recordings` ADD `source_language` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `recordings` ADD `target_language` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `recordings` ADD `translation_provider` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `recordings` ADD `translation_edited` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `voices` ADD `localization_gender` text;