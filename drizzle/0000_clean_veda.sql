CREATE TABLE `screenshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trade_id` integer NOT NULL,
	`file_path` text NOT NULL,
	`thumb_path` text NOT NULL,
	`width` integer,
	`height` integer,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `screenshots_trade_idx` ON `screenshots` (`trade_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `trade_tags` (
	`trade_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`trade_id`, `tag_id`),
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`instrument_type` text NOT NULL,
	`symbol` text NOT NULL,
	`exchange` text,
	`direction` text NOT NULL,
	`quantity` real NOT NULL,
	`multiplier` real DEFAULT 1 NOT NULL,
	`entry_price` real NOT NULL,
	`exit_price` real,
	`stop_price` real,
	`target_price` real,
	`fees` real DEFAULT 0 NOT NULL,
	`strike` real,
	`expiry` text,
	`right` text,
	`setup` text,
	`notes` text DEFAULT '' NOT NULL,
	`pnl` real,
	`r_multiple` real,
	`entry_at` integer NOT NULL,
	`exit_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trades_status_idx` ON `trades` (`status`);--> statement-breakpoint
CREATE INDEX `trades_symbol_idx` ON `trades` (`symbol`);--> statement-breakpoint
CREATE INDEX `trades_entry_at_idx` ON `trades` (`entry_at`);