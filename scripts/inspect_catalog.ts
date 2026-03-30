import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function checkCatalog() {
  const prods = await db.all(sql`SELECT id, name FROM products LIMIT 50`);
  console.log(prods);
  process.exit(0);
}

checkCatalog();
