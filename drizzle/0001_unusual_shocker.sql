ALTER TABLE `users` ADD `email` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `pin_hash`;