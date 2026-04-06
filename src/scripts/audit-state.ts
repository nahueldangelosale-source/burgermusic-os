import "dotenv/config";
import { db } from "../db";
import { fact_sales } from "../db/schema";
import { cash_register_closures } from "../db/schema/treasury";
import { sql, isNull, or, eq } from "drizzle-orm";

async function main() {
  console.log("=== SRE FORENSIC AUDIT ===");

  // 1. COGS_LEAK_COUNT
  const cogsLeakQuery = await db
    .select({ leak_count: sql`COUNT(*)` })
    .from(fact_sales)
    .where(
      or(
        isNull(fact_sales.historical_cost_cents),
        eq(fact_sales.historical_cost_cents, 0)
      )
    );

  const leakCount = cogsLeakQuery[0]?.leak_count || 0;
  console.log(`COGS_LEAK_COUNT: ${leakCount} filas en fact_sales con cost_cents NULL o 0`);

  // 2. DISTINCT_PAYMENT_METHODS
  const distinctMethodsQuery = await db
    .select({ method: cash_register_closures.payment_method })
    .from(cash_register_closures)
    .groupBy(cash_register_closures.payment_method);

  const methods = distinctMethodsQuery.map((row) => row.method);
  console.log(`DISTINCT_PAYMENT_METHODS:`, methods);

  console.log("=== END AUDIT ===");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
