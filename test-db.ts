import "dotenv/config";
import { db } from "./src/db";
import { products } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const PRODUCT_SKU = "PRD-HAMBURGUESA-TEST";
  console.log(`[CHECK] Investigando SKU: ${PRODUCT_SKU}`);
  const res = await db.select().from(products).where(eq(products.id, PRODUCT_SKU));
  console.log("RESULT:", JSON.stringify(res, null, 2));
  
  if (res.length === 0) {
    console.log("[CHECK] El producto NO existe en la base de datos.");
    const all = await db.select({ id: products.id }).from(products).limit(5);
    console.log("[CHECK] Muestra de IDs existentes:", all);
  }
}

main().catch(console.error);
