import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { transactions } from "../src/db/schema";

async function cleanDuplicates() {
  console.log("Cleaning duplicate transactions for the unique constraint...");
  // We'll keep the one with the lowest ID and delete the rest
  const query = sql`
    DELETE FROM transactions 
    WHERE id NOT IN (
      SELECT MIN(id) 
      FROM transactions 
      WHERE reference_id IS NOT NULL 
      GROUP BY reference_id, store_id
    ) AND reference_id IS NOT NULL;
  `;

  try {
    await db.run(query);
    console.log("Cleanup complete.");
  } catch (err) {
    console.error("Error cleaning:", err);
  }
}

cleanDuplicates().then(() => process.exit(0));
