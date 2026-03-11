import "dotenv/config";
import { db } from "./index";
import { products, recipes } from "./schema";
import { count } from "drizzle-orm";

async function main() {
    const pCount = await db.select({ count: count() }).from(products);
    const rCount = await db.select({ count: count() }).from(recipes);

    console.log(`Products: ${pCount[0].count}`);
    console.log(`Recipes: ${rCount[0].count}`);
}

main();
