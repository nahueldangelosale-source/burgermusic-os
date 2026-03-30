import "dotenv/config";
import { db } from "../db";
import { recipe_items } from "../db/schema";
import { eq } from "drizzle-orm";

async function check() {
  const items = await db.select().from(recipe_items).where(eq(recipe_items.productSku, "PROD-PAPAS-QUEEN"));
  console.log("Recipes for PROD-PAPAS-QUEEN:", JSON.stringify(items, null, 2));
}

check();
