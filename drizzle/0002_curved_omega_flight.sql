CREATE TABLE `checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text DEFAULT 'centro',
	`shift_date` text NOT NULL,
	`task_name` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`completed_by` text,
	`timestamp` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`completed_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text DEFAULT 'centro',
	`name` text NOT NULL,
	`role` text NOT NULL,
	`hourly_rate` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `gateway_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'MercadoPago',
	`amount` integer NOT NULL,
	`settlement_date` text NOT NULL,
	`status` text DEFAULT 'PENDING',
	`store_id` text DEFAULT 'centro',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `legal_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text DEFAULT 'centro',
	`document_type` text NOT NULL,
	`expiration_date` text NOT NULL,
	`alert_triggered` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `bill_of_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text NOT NULL,
	`child_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_multiplier` real DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `raw_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'INGREDIENTES' NOT NULL,
	`base_unit` text NOT NULL,
	`gross_cost_cents` integer NOT NULL,
	`historical_yield_pct` real DEFAULT 1 NOT NULL,
	`true_cost_per_unit_cents` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sellable_products` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`category` text DEFAULT 'GENERAL' NOT NULL,
	`price_cents` integer NOT NULL,
	`live_margin_cents` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sellable_products_sku_unique` ON `sellable_products` (`sku`);--> statement-breakpoint
DROP INDEX `ap_invoice_cuit_idx`;--> statement-breakpoint
ALTER TABLE `accounts_payable` ADD `supplier_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts_payable` ADD `po_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts_payable` ADD `receipt_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts_payable` ADD `invoice_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts_payable` ADD `credit_note_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts_payable` ADD `due_date` text NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts_payable` DROP COLUMN `cuit`;--> statement-breakpoint
ALTER TABLE `accounts_payable` DROP COLUMN `invoice_number`;--> statement-breakpoint
ALTER TABLE `accounts_payable` DROP COLUMN `amount`;--> statement-breakpoint
ALTER TABLE `accounts_payable` DROP COLUMN `payment_method`;--> statement-breakpoint
ALTER TABLE `opex_ledger` ADD `type` text NOT NULL;--> statement-breakpoint
ALTER TABLE `opex_ledger` ADD `total_amount` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `opex_ledger` ADD `daily_accrual_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `opex_ledger` ADD `calculation_type` text;--> statement-breakpoint
ALTER TABLE `opex_ledger` ADD `percentage_rate` real;--> statement-breakpoint
ALTER TABLE `opex_ledger` ADD `start_date` text NOT NULL;--> statement-breakpoint
ALTER TABLE `opex_ledger` ADD `end_date` text;--> statement-breakpoint
ALTER TABLE `opex_ledger` DROP COLUMN `amount`;--> statement-breakpoint
ALTER TABLE `opex_ledger` DROP COLUMN `date`;