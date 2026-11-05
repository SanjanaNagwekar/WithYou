CREATE TABLE `benchmark_review_surveys` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL CHECK (`status` IN ('draft','active','closed')),
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_review_survey_run_unique` ON `benchmark_review_surveys` (`run_id`);
--> statement-breakpoint
CREATE TABLE `benchmark_review_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`survey_id` text NOT NULL,
	`reviewer_label` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_review_invite_token_unique` ON `benchmark_review_invites` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_benchmark_review_invites_survey` ON `benchmark_review_invites` (`survey_id`);
--> statement-breakpoint
CREATE TABLE `benchmark_review_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_id` text NOT NULL,
	`position` integer NOT NULL,
	`case_id` text NOT NULL,
	`speaker_id` text NOT NULL,
	`prompt_text` text NOT NULL,
	`reference_key` text NOT NULL,
	`candidate_a_key` text NOT NULL,
	`candidate_b_key` text NOT NULL,
	`candidate_a_provider` text NOT NULL,
	`candidate_b_provider` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_review_item_invite_case_unique` ON `benchmark_review_items` (`invite_id`,`case_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_review_item_position_unique` ON `benchmark_review_items` (`invite_id`,`position`);
--> statement-breakpoint
CREATE INDEX `idx_benchmark_review_items_invite` ON `benchmark_review_items` (`invite_id`);
--> statement-breakpoint
CREATE TABLE `benchmark_review_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_id` text NOT NULL,
	`item_id` text NOT NULL,
	`similarity_choice` text NOT NULL CHECK (`similarity_choice` IN ('a','b','tie')),
	`naturalness_choice` text NOT NULL CHECK (`naturalness_choice` IN ('a','b','tie')),
	`pronunciation_choice` text NOT NULL CHECK (`pronunciation_choice` IN ('a','b','tie')),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_review_response_unique` ON `benchmark_review_responses` (`invite_id`,`item_id`);
--> statement-breakpoint
CREATE INDEX `idx_benchmark_review_responses_invite` ON `benchmark_review_responses` (`invite_id`);
