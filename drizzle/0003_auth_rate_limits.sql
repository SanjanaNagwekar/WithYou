CREATE TABLE `authRateLimit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`lastRequest` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_rate_limit_key_unique` ON `authRateLimit` (`key`);
--> statement-breakpoint
UPDATE `account`
SET `accessToken` = NULL,
	`refreshToken` = NULL,
	`idToken` = NULL
WHERE `providerId` != 'credential';
