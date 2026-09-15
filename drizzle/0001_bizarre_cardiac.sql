CREATE TABLE `generation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`voice_id` text NOT NULL,
	`recording_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_generation_events_owner_created` ON `generation_events` (`owner`,`created_at`);--> statement-breakpoint
ALTER TABLE `recordings` ADD `mood` text DEFAULT 'natural' NOT NULL;--> statement-breakpoint
ALTER TABLE `recordings` ADD `pace` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `recordings` ADD `volume` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `recordings` ADD `updated_at` text DEFAULT '' NOT NULL;