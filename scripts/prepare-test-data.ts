import "dotenv/config";
import { db } from "../src/db";
import { products, suppliers } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const [sup] = await db.select().from(suppliers).limit(1);
  if (!sup) {
    console.error("No suppliers found to link.");
    process.exit(1);
  }

  await db.update(products)
    .set({ safetyStock: 10, supplierId: sup.id })
    .where(sql`id LIKE 'PDR_%' OR id = 'PDR_HARINA'`);
  
  console.log(`Updated products with safetyStock=10 and supplierId=${sup.id}`);
  process.exit(0);
}

main().catch(console.error);
