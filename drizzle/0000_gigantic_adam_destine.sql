CREATE TABLE `accounts_payable` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`po_amount` integer DEFAULT 0 NOT NULL,
	`receipt_amount` integer DEFAULT 0 NOT NULL,
	`invoice_amount` integer DEFAULT 0 NOT NULL,
	`credit_note_amount` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PENDING',
	`store_id` text NOT NULL,
	`due_date` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `agenda_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'TASK' NOT NULL,
	`due_date` text,
	`is_completed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `ai_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_name` text NOT NULL,
	`action` text NOT NULL,
	`payload_ref` text,
	`zod_schema_used` text NOT NULL,
	`status` text NOT NULL,
	`rejection_reason` text,
	`user_id` text,
	`store_id` text NOT NULL,
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
	`store_id` text NOT NULL,
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
CREATE TABLE `checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`shift_date` text NOT NULL,
	`task_name` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`completed_by` text,
	`timestamp` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`completed_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
	`store_id` text NOT NULL,
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
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`hourly_rate` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `fact_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`date` text NOT NULL,
	`shift` text DEFAULT 'UNICO' NOT NULL,
	`raw_name` text DEFAULT '' NOT NULL,
	`product_sku` text NOT NULL,
	`quantity` real NOT NULL,
	`net_price_cents` integer NOT NULL,
	`historical_cost_cents` integer DEFAULT 0,
	`historical_price_cents` integer DEFAULT 0,
	`ticket_number` text,
	`payment_method` text DEFAULT 'UNKNOWN',
	`status` text DEFAULT 'COMPLETED',
	`depleted` integer DEFAULT false,
	`completed_at` text,
	`ticket_hash` text,
	`variant_metadata` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fact_sales_ticket_hash_unique` ON `fact_sales` (`ticket_hash`);--> statement-breakpoint
CREATE TABLE `fact_supplier_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`type` text NOT NULL,
	`invoice_number` text,
	`description` text,
	`amount_cents` integer NOT NULL,
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`reference_id` text,
	`date` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fact_taxes` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`tax_type` text NOT NULL,
	`base_amount_cents` integer NOT NULL,
	`tax_amount_cents` integer NOT NULL,
	`date` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `gateway_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'MercadoPago',
	`amount` integer NOT NULL,
	`settlement_date` text NOT NULL,
	`status` text DEFAULT 'PENDING',
	`store_id` text NOT NULL,
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
	`id` text PRIMARY KEY NOT NULL,
	`date` text DEFAULT (CURRENT_TIMESTAMP),
	`store_id` text NOT NULL,
	`reported_by` text DEFAULT 'WebApp User',
	`status` text DEFAULT 'RECONCILED' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `inventory_kardex` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`product_sku` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`reference_id` text,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `labor_costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_id` text NOT NULL,
	`date` text NOT NULL,
	`shift` text,
	`total_hours` real NOT NULL,
	`cost_amount` real NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `legal_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`document_type` text NOT NULL,
	`expiration_date` text NOT NULL,
	`alert_triggered` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `mdm_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`yield_percentage` real DEFAULT 1 NOT NULL,
	`ingredient_type` text DEFAULT 'PURCHASED_READY' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mdm_ingredients_canonical_name_unique` ON `mdm_ingredients` (`canonical_name`);--> statement-breakpoint
CREATE TABLE `modifier_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`modifier_id` text NOT NULL,
	`inventory_item_id` text NOT NULL,
	`quantity` real NOT NULL,
	FOREIGN KEY (`modifier_id`) REFERENCES `modifiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `modifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price_cents_adjustment` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `opex_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`total_amount` integer NOT NULL,
	`daily_accrual_amount` integer DEFAULT 0 NOT NULL,
	`calculation_type` text,
	`percentage_rate` real,
	`start_date` text NOT NULL,
	`end_date` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `outbox_events` (
	`id` text PRIMARY KEY NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`store_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`processed_at` text
);
--> statement-breakpoint
CREATE TABLE `payment_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_applied` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`payment_id`) REFERENCES `supplier_payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `accounts_payable`(`id`) ON UPDATE no action ON DELETE no action
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
	`store_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `petty_cash_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
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
CREATE TABLE `product_modifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`modifier_id` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`modifier_id`) REFERENCES `modifiers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `production_batch_inputs` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`quantity_used_grams` integer NOT NULL,
	`unit_cost_cents` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `production_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`produced_ingredient_id` text NOT NULL,
	`quantity_produced` integer NOT NULL,
	`total_cost_cents` integer NOT NULL,
	`cost_per_unit_cents` integer NOT NULL,
	`yield_factor` real DEFAULT 8.1 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text,
	`name` text NOT NULL,
	`unit` text DEFAULT 'UNIDAD' NOT NULL,
	`item_type` text DEFAULT 'MANUFACTURED' NOT NULL,
	`category` text DEFAULT 'GENERAL',
	`base_price_cents` integer DEFAULT 0,
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
	`deleted_at` integer,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_items` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`purchase_id` text,
	`inventory_item_id` text,
	`quantity` real NOT NULL,
	`total_line_cents` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`suggested_qty` real NOT NULL,
	`status` text DEFAULT 'Riesgo de Quiebre (ADC)',
	`created_at` text DEFAULT (CURRENT_DATE)
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`supplier_id` text,
	`supplier_name` text NOT NULL,
	`invoice_number` text,
	`total_cents` integer NOT NULL,
	`status` text DEFAULT 'COMPLETED',
	`audited_at` text,
	`audited_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
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
	`store_id` text NOT NULL,
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
	`store_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`created_by` text
);
--> statement-breakpoint
CREATE TABLE `recipe_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_sku` text,
	`ingredient_sku` text,
	`quantity` real NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`deleted_at` integer,
	FOREIGN KEY (`product_sku`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_sku`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_item_unq` ON `recipe_items` (`product_sku`,`ingredient_sku`);--> statement-breakpoint
CREATE TABLE `recurring_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`description` text NOT NULL,
	`monthly_amount` real NOT NULL,
	`day_of_month` integer NOT NULL,
	`category` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `sales_mapping_dlq` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`raw_name` text NOT NULL,
	`quantity` real NOT NULL,
	`price` integer NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`timestamp` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `sku_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`raw_sku` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sku_aliases_raw_sku_unique` ON `sku_aliases` (`raw_sku`);--> statement-breakpoint
CREATE TABLE `snapshot_items` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text,
	`raw_material_id` text,
	`physical_count_purchase_unit` real NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`snapshot_id`) REFERENCES `inventory_snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`raw_material_id`) REFERENCES `raw_materials`(`id`) ON UPDATE no action ON DELETE no action
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
CREATE TABLE `supplier_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`method` text NOT NULL,
	`reference_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
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
	`email` text,
	`phone` text,
	`postal_code` text,
	`address` text,
	`payment_methods` text DEFAULT '["TRANSFERENCIA"]',
	`invoice_type` text DEFAULT 'FACTURA',
	`active` integer DEFAULT true,
	`deleted_at` integer
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
CREATE TABLE `system_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`details` text NOT NULL,
	`is_locked` integer DEFAULT false,
	`is_resolved` integer DEFAULT false,
	`resolved_by` text,
	`justification` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transaction_items` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` integer,
	`product_sku` text,
	`quantity` real NOT NULL,
	`frozen_unit_price_cents` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_sku`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`product_sku` text NOT NULL,
	`quantity` real NOT NULL,
	`cost_cents_at_time` integer DEFAULT 0,
	`reference_id` text,
	`notes` text,
	`store_id` text NOT NULL,
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
	`store_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `bill_of_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text NOT NULL,
	`child_id` text,
	`raw_child_name` text,
	`quantity` real NOT NULL,
	`unit_multiplier` real DEFAULT 1 NOT NULL,
	`deleted_at` integer
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
	`true_cost_per_unit_cents` real NOT NULL,
	`purchase_unit` text DEFAULT 'UNIDAD' NOT NULL,
	`recipe_unit` text DEFAULT 'UNIDAD' NOT NULL,
	`conversion_factor` real DEFAULT 1 NOT NULL,
	`deleted_at` integer
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
CREATE TABLE `cash_register_closures` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`shift` text NOT NULL,
	`closed_at` text NOT NULL,
	`payment_method` text NOT NULL,
	`total_cents` integer NOT NULL,
	`difference_cents` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `expense_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`expense_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`deleted_at` integer,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`expense_type` text NOT NULL,
	`net_amount_cents` integer NOT NULL,
	`tax_amount_cents` integer NOT NULL,
	`withholdings_cents` integer NOT NULL,
	`gross_amount_cents` integer NOT NULL,
	`reference_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `petty_cash_fund` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`fund_name` text DEFAULT 'Caja Chica' NOT NULL,
	`current_balance_cents` integer DEFAULT 0 NOT NULL,
	`last_replenished_at` text,
	`audited_by` text,
	`audited_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `supplier_current_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`debt_cents` integer DEFAULT 0 NOT NULL,
	`credit_cents` integer DEFAULT 0 NOT NULL,
	`due_date` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `treasury_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`account_name` text NOT NULL,
	`account_type` text DEFAULT 'BANK' NOT NULL,
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`audited_by` text,
	`audited_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `goods_receipt_items` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`inventory_item_id` text NOT NULL,
	`expected_quantity` real NOT NULL,
	`actual_received_quantity` real NOT NULL,
	`variance_quantity` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `goods_receipts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `goods_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`receipt_date` text DEFAULT (CURRENT_DATE) NOT NULL,
	`total_cost_cents` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`measurement_unit` text NOT NULL,
	`current_stock` real DEFAULT 0,
	`min_stock_alert` real DEFAULT 0,
	`maximum_capacity` real DEFAULT 100,
	`cost_per_unit_cents` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` text,
	`audited_at` text,
	`audited_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`poId` text NOT NULL,
	`ingredientId` text NOT NULL,
	`quantityGrams` integer NOT NULL,
	`unitPriceCents` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`poId`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text DEFAULT 'STR_DEFAULT' NOT NULL,
	`supplierId` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`totalAmountCents` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`item_id` text NOT NULL,
	`movement_type` text NOT NULL,
	`quantity` real NOT NULL,
	`reference_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `supplier_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`po_id` text NOT NULL,
	`status` text DEFAULT 'DISPUTED' NOT NULL,
	`missing_details` text NOT NULL,
	`ai_claim_draft` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`resolved_at` text,
	FOREIGN KEY (`receipt_id`) REFERENCES `goods_receipts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `supplier_claims_po_idx` ON `supplier_claims` (`po_id`);--> statement-breakpoint
CREATE TABLE `supplier_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`last_purchase_price_cents` integer DEFAULT 0 NOT NULL,
	`is_preferred` integer DEFAULT false NOT NULL,
	`lead_time_hours` integer DEFAULT 24 NOT NULL,
	`purchase_unit` text DEFAULT 'KG' NOT NULL,
	`min_order_qty` real DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX `si_ingredient_idx` ON `supplier_ingredients` (`ingredient_id`);--> statement-breakpoint
CREATE INDEX `si_supplier_idx` ON `supplier_ingredients` (`supplier_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_ingredient_unq` ON `supplier_ingredients` (`supplier_id`,`ingredient_id`);--> statement-breakpoint
CREATE TABLE `supplier_item_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`supplier_item_name` text NOT NULL,
	`internal_ingredient_id` text NOT NULL,
	`conversion_factor` integer NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX `sim_name_idx` ON `supplier_item_mappings` (`supplier_id`,`supplier_item_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `sup_item_map_unq` ON `supplier_item_mappings` (`supplier_id`,`supplier_item_name`);--> statement-breakpoint
CREATE TABLE `supplier_skus` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`sku_name` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX `ss_supplier_idx` ON `supplier_skus` (`supplier_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_sku_unq` ON `supplier_skus` (`supplier_id`,`sku_name`);--> statement-breakpoint
CREATE TABLE `zombie_shift_audits` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`target_date` text NOT NULL,
	`reported_margin_percent` integer NOT NULL,
	`reported_revenue_cents` integer DEFAULT 0 NOT NULL,
	`reported_cogs_cents` integer DEFAULT 0 NOT NULL,
	`reported_shrinkage_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`manager_justification` text,
	`resolved_at` text,
	`resolved_by` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `inventory_batches` (
	`batch_id` text PRIMARY KEY NOT NULL,
	`receipt_id` text,
	`ingredient_sku` text NOT NULL,
	`supplier_id` text NOT NULL,
	`raw_qty` real NOT NULL,
	`current_qty` real NOT NULL,
	`unit_cost_cents` integer NOT NULL,
	`status` text DEFAULT 'READY',
	`expiration_date` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `prep_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`yield_qty` real NOT NULL,
	`waste_qty` real NOT NULL,
	`operator_id` text NOT NULL,
	`timestamp` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`batch_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `unmapped_pos_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`raw_name` text NOT NULL,
	`pos_data` text NOT NULL,
	`reason` text DEFAULT 'LOW_CONFIDENCE' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `uom_conversions` (
	`id` text PRIMARY KEY NOT NULL,
	`from_unit` text NOT NULL,
	`to_base_unit` text NOT NULL,
	`multiplier` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_translation_idx` ON `uom_conversions` (`from_unit`,`to_base_unit`);