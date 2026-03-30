CREATE TABLE `fact_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text DEFAULT 'centro',
	`date` text NOT NULL,
	`shift` text NOT NULL,
	`raw_name` text NOT NULL,
	`product_sku` text NOT NULL,
	`quantity` real NOT NULL,
	`net_price_cents` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `purchase_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`suggested_qty` real NOT NULL,
	`status` text DEFAULT 'Riesgo de Quiebre (ADC)',
	`created_at` text DEFAULT (CURRENT_DATE)
);
