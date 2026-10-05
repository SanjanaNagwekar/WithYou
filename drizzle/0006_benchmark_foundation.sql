CREATE TABLE `generation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`voice_id` text NOT NULL,
	`recording_id` text,
	`operation` text NOT NULL CHECK (`operation` IN ('create','update','benchmark')),
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`source_language` text DEFAULT 'en' NOT NULL,
	`target_language` text NOT NULL,
	`input_characters` integer NOT NULL,
	`reference_bytes` integer,
	`translation_provider` text DEFAULT 'none' NOT NULL,
	`translation_latency_ms` integer,
	`clone_latency_ms` integer,
	`localization_latency_ms` integer,
	`synthesis_latency_ms` integer,
	`total_latency_ms` integer,
	`output_bytes` integer,
	`status` text NOT NULL CHECK (`status` IN ('started','succeeded','failed')),
	`error_category` text,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_generation_runs_owner_created` ON `generation_runs` (`owner`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_generation_runs_status_created` ON `generation_runs` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_generation_runs_model_language` ON `generation_runs` (`provider`,`model`,`target_language`);
--> statement-breakpoint
CREATE TABLE `benchmark_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL CHECK (`status` IN ('draft','running','completed','failed')),
	`prompt_set_version` text NOT NULL,
	`experiment_config_json` text NOT NULL,
	`consent_confirmed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_benchmark_runs_owner_created` ON `benchmark_runs` (`owner`,`created_at`);
--> statement-breakpoint
CREATE TABLE `benchmark_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`benchmark_run_id` text NOT NULL,
	`anonymous_speaker_id` text NOT NULL,
	`source_recording_id` text NOT NULL,
	`prompt_key` text NOT NULL,
	`prompt_sha256` text NOT NULL,
	`language` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_case_unique` ON `benchmark_cases` (`benchmark_run_id`,`anonymous_speaker_id`,`prompt_key`,`language`);
--> statement-breakpoint
CREATE INDEX `idx_benchmark_cases_run` ON `benchmark_cases` (`benchmark_run_id`);
--> statement-breakpoint
CREATE TABLE `benchmark_outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`benchmark_case_id` text NOT NULL,
	`generation_run_id` text NOT NULL,
	`recording_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_output_generation_unique` ON `benchmark_outputs` (`generation_run_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_output_model_unique` ON `benchmark_outputs` (`benchmark_case_id`,`provider`,`model`);
--> statement-breakpoint
CREATE TABLE `benchmark_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`benchmark_output_id` text NOT NULL,
	`metric` text NOT NULL,
	`value` real NOT NULL,
	`evaluator` text NOT NULL,
	`evaluator_version` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_score_unique` ON `benchmark_scores` (`benchmark_output_id`,`metric`,`evaluator`,`evaluator_version`);
--> statement-breakpoint
CREATE INDEX `idx_benchmark_scores_output` ON `benchmark_scores` (`benchmark_output_id`);
--> statement-breakpoint
CREATE TABLE `benchmark_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`benchmark_output_id` text NOT NULL,
	`anonymous_reviewer_id` text NOT NULL,
	`speaker_similarity` integer NOT NULL CHECK (`speaker_similarity` BETWEEN 1 AND 5),
	`naturalness` integer NOT NULL CHECK (`naturalness` BETWEEN 1 AND 5),
	`pronunciation_accuracy` integer NOT NULL CHECK (`pronunciation_accuracy` BETWEEN 1 AND 5),
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `benchmark_rating_unique` ON `benchmark_ratings` (`benchmark_output_id`,`anonymous_reviewer_id`);
--> statement-breakpoint
CREATE INDEX `idx_benchmark_ratings_output` ON `benchmark_ratings` (`benchmark_output_id`);
