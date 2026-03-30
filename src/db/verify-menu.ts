import "dotenv/config";
import { count } from "drizzle-orm";
import { db } from "./index";
import { products, recipe_items } from "./schema";

async function main() {
  const pCount = await db.select({ count: count() }).from(products);
  const rCount = await db.select({ count: count() }).from(recipe_items);

  console.log(`Products: ${pCount[0].count}`);
  console.log(`Recipes: ${rCount[0].count}`);
}

main();
