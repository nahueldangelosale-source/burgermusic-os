import { db } from "../src/db";
import { products } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function check() {
  const all = await db.select().from(products);
  console.log("Total products:", all.length);
  const pizzaXl = all.filter(p => p.category === "PIZZAS XL");
  console.log("PIZZAS XL count:", pizzaXl.length);
  const saleable = all.filter(p => p.isSaleable);
  console.log("Saleable count:", saleable.length);
  const pdrCount = all.filter(p => p.id.startsWith("PDR_")).length;
  console.log("PDR_ count:", pdrCount);
  process.exit(0);
}

check();
