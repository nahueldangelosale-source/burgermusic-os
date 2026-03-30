import "dotenv/config";
import { db } from "./src/db";
import { sql } from "drizzle-orm";

async function run() {
  await db.run(sql`UPDATE raw_materials SET gross_cost_cents = 0, true_cost_per_unit_cents = 0`);
  await db.run(sql`UPDATE sellable_products SET price_cents = 0`);
  console.log('Mocks eliminados O(1)');
  process.exit(0);
}
run();
