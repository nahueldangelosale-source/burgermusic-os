import "dotenv/config";
import { db } from "./src/db";
import { products, recipe_items } from "./src/db/schema";

async function run() {
  console.log("Products:");
  const allP = await db.select().from(products);
  allP.forEach((p) => console.log(p.id, p.name));

  console.log("Recipes:");
  const allR = await db.select().from(recipe_items);
  allR.forEach((r) => console.log(r.id, "prod:", r.productSku, "ingr:", r.ingredientSku));
}
run().catch(console.error);
