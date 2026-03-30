import "dotenv/config";
import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function solve() {
  console.log("Checking TOTAL products...");
  const total = await db.run(sql`SELECT count(*) as count FROM products`);
  console.log("Total products in DB:", JSON.stringify(total.rows[0]));

  console.log("Checking SALEABLE products...");
  const saleable = await db.run(sql`SELECT count(*) as count FROM products WHERE is_saleable = 1`);
  console.log("Saleable (is_saleable = 1):", JSON.stringify(saleable.rows[0]));

  console.log("Checking SALEABLE products (Boolean True)...");
  const saleableBool = await db.run(sql`SELECT count(*) as count FROM products WHERE is_saleable = TRUE`);
  console.log("Saleable (is_saleable = TRUE):", JSON.stringify(saleableBool.rows[0]));

  process.exit(0);
}

solve();
