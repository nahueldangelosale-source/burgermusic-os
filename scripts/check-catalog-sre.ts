import "dotenv/config";
import { db } from "../src/db";
import { products, suppliers } from "../src/db/schema";
import { sql, isNull, and } from "drizzle-orm";

async function main() {
  console.log("=".repeat(60));
  console.log("[SRE-DIAGNOSTIC] Checking Catalog State for P0 Certification");
  console.log("=".repeat(60));

  // 1. Check if any product has safetyStock and supplierId
  const allProds = await db.select({
    id: products.id,
    name: products.name,
    safetyStock: products.safetyStock,
    supplierId: products.supplierId,
    deletedAt: products.deletedAt,
  }).from(products).limit(10);

  console.log("Sample Products:");
  console.table(allProds);

  const candidates = await db.select({ count: sql<number>`count(*)` })
    .from(products)
    .where(and(sql`${products.safetyStock} > 0`, sql`${products.supplierId} IS NOT NULL`));

  console.log(`Products with safetyStock > 0 AND supplierId: ${candidates[0].count}`);

  const activeSuppliers = await db.select({ count: sql<number>`count(*)` })
    .from(suppliers)
    .where(isNull(suppliers.deletedAt));
  
  console.log(`Active Suppliers (isNull(deletedAt)): ${activeSuppliers[0].count}`);

  process.exit(0);
}

main().catch(console.error);
