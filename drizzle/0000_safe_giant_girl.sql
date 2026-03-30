CREATE TABLE `accounts_payable` (
	`id` text PRIMARY KEY NOT NULL,
	`cuit` text NOT NULL,
	`invoice_number` text NOT NULL,
	`amount` real NOT NULL,
	`payment_method` text,
	`status` text DEFAULT 'PENDING',
	`store_id` text DEFAULT 'centro',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ap_invoice_cuit_idx` ON `accounts_payable` (`invoice_number`,`cuit`);--> statement-breakpoint
CREATE TABLE `ai_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_name` text NOT NULL,
	`action` text NOT NULL,
	`payload_ref` text,
	`zod_schema_used` text NOT NULL,
	`status` text NOT NULL,
	`rejection_reason` text,
	`user_id` text,
	`store_id` text DEFAULT 'centro',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`active` integer DEFAULT true,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_store_id_unique` ON `api_keys` (`store_id`);--> statement-breakpoint
CREATE TABLE `bom_recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`product_sku` text,
	`ingredient_id` text,
	`theoretical_qty` real NOT NULL,
	FOREIGN KEY (`product_sku`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_id`) REFERENCES `mdm_ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cash_register_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text DEFAULT 'centro',
	`date` text NOT NULL,
	`register_num` text NOT NULL,
	`shift` text NOT NULL,
	`opening_amount` real NOT NULL,
	`closing_amount` real NOT NULL,
	`discrepancy` real NOT NULL,
	`cash_in_register` real NOT NULL,
	`payment_method` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_reg_tx_unq` ON `cash_register_transactions` (`date`,`register_num`,`shift`,`payment_method`);--> statement-breakpoint
CREATE TABLE `daily_cash_closures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`day` text,
	`z_close` real,
	`shift` text,
	`sales_counter` real,
	`sales_mp_qr` real,
	`sales_delivery` real,
	`total_mp` real,
	`total_cash` real,
	`total_delivery` real,
	`total_global` real,
	`labor_cost` real,
	`variance` real,
	`store_id` text DEFAULT 'centro',
	`sheet_month` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `data_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`status` text NOT NULL,
	`rows_processed` integer DEFAULT 0,
	`rows_failed` integer DEFAULT 0,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `ingredient_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`ingredient_sku` text NOT NULL,
	`price_cents` integer NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_sku`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_ingredient_idx` ON `ingredient_quotes` (`supplier_id`,`ingredient_sku`);--> statement-breakpoint
CREATE TABLE `inventory_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text DEFAULT (CURRENT_TIMESTAMP),
	`product_sku` text NOT NULL,
	`actual_count` real NOT NULL,
	`raw_input` text NOT NULL,
	`store_id` text DEFAULT 'centro',
	`reported_by` text DEFAULT 'WebApp User',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `inventory_kardex` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`product_sku` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `labor_costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_id` text DEFAULT 'centro',
	`date` text NOT NULL,
	`shift` text,
	`total_hours` real NOT NULL,
	`cost_amount` real NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `mdm_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`yield_percentage` real DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mdm_ingredients_canonical_name_unique` ON `mdm_ingredients` (`canonical_name`);--> statement-breakpoint
CREATE TABLE `opex_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`store_id` text DEFAULT 'centro',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `outbox_events` (
	`id` text PRIMARY KEY NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`store_id` text DEFAULT 'centro',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`processed_at` text
);
--> statement-breakpoint
CREATE TABLE `payment_gateways_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`gateway` text DEFAULT 'MERCADO_PAGO' NOT NULL,
	`transaction_reference` text NOT NULL,
	`date` text NOT NULL,
	`gross_amount` real NOT NULL,
	`fee_amount` real DEFAULT 0 NOT NULL,
	`tax_amount` real DEFAULT 0 NOT NULL,
	`net_amount` real NOT NULL,
	`release_date` text NOT NULL,
	`status` text DEFAULT 'CLEARED',
	`store_id` text DEFAULT 'centro',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `petty_cash_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text DEFAULT 'centro',
	`amount` real NOT NULL,
	`reason` text NOT NULL,
	`supplier_id` text,
	`cost_center` text DEFAULT 'Cocina',
	`expense_date` text,
	`reference_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reference_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `po_items` (
	`id` text PRIMARY KEY NOT NULL,
	`po_id` text,
	`product_id` text,
	`quantity_suggested` real,
	`quantity_ordered` real,
	`unit_cost_snapshot` integer,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_sku` text NOT NULL,
	`old_cost` integer NOT NULL,
	`new_cost` integer NOT NULL,
	`changed_by` text,
	`change_reason` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`product_sku`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`unit` text DEFAULT 'UNIDAD' NOT NULL,
	`category` text DEFAULT 'BURGER',
	`base_price_cents` integer DEFAULT 0,
	`includes_fries` integer DEFAULT false,
	`description` text,
	`is_saleable` integer DEFAULT false,
	`cost_cents` integer DEFAULT 0,
	`selling_price` integer DEFAULT 0,
	`target_margin` integer DEFAULT 30,
	`supplier_id` text,
	`safety_stock` real DEFAULT 0,
	`weight_grams` integer DEFAULT 0,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`synonyms` text DEFAULT '[]',
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_items` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_id` text,
	`product_id` text,
	`quantity` real NOT NULL,
	`unit_cost` real NOT NULL,
	`variance_flag` integer DEFAULT false,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text,
	`status` text DEFAULT 'DRAFT',
	`total_estimated` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`delivery_date` text
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text,
	`receiver_user_id` text,
	`total_amount` real NOT NULL,
	`invoice_image_url` text,
	`status` text DEFAULT 'COMPLETED',
	`store_id` text DEFAULT 'centro',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiver_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `receipt_items` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text,
	`product_name` text NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`unit_price` real NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_name` text NOT NULL,
	`invoice_number` text,
	`total_amount` real NOT NULL,
	`has_tax_credit` integer DEFAULT true,
	`entry_mode` text NOT NULL,
	`status` text DEFAULT 'APPROVED',
	`store_id` text DEFAULT 'centro',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `receptions` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier` text NOT NULL,
	`invoice_number` text NOT NULL,
	`total_amount` integer NOT NULL,
	`file_url` text,
	`mime_type` text,
	`status` text DEFAULT 'PENDING',
	`raw_data` text NOT NULL,
	`store_id` text DEFAULT 'centro',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`created_by` text
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_sku` text,
	`ingredient_sku` text,
	`quantity` real NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`product_sku`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_sku`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `recurring_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text DEFAULT 'centro',
	`description` text NOT NULL,
	`monthly_amount` real NOT NULL,
	`day_of_month` integer NOT NULL,
	`category` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `supplier_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` text,
	`po_id` text,
	`date` text NOT NULL,
	`lead_time_hours` real NOT NULL,
	`is_full` integer DEFAULT true,
	`is_on_time` integer DEFAULT true,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cuit` text NOT NULL,
	`cbu` text DEFAULT '' NOT NULL,
	`contact_info` text,
	`category` text DEFAULT 'Insumos',
	`payment_terms` text DEFAULT 'Contado',
	`payment_method` text DEFAULT 'TRANSFERENCIA',
	`lead_time` integer DEFAULT 24,
	`frequency` text,
	`phone` text,
	`address` text,
	`payment_methods` text DEFAULT '["TRANSFERENCIA"]',
	`invoice_type` text DEFAULT 'FACTURA',
	`active` integer DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_cuit_unique` ON `suppliers` (`cuit`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_key` text NOT NULL,
	`last_synced_row` integer DEFAULT 0,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_state_sync_key_unique` ON `sync_state` (`sync_key`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`product_sku` text NOT NULL,
	`quantity` real NOT NULL,
	`cost_cents_at_time` integer DEFAULT 0,
	`reference_id` text,
	`notes` text,
	`store_id` text DEFAULT 'centro',
	`created_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`product_sku`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`pin_hash` text NOT NULL,
	`store_id` text DEFAULT 'centro',
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
