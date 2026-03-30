import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { users } from "../src/db/schema";

async function main() {
  console.log("🔄 Updating Admin PIN to numeric...");

  await db.update(users).set({ pin_hash: "123456" }).where(eq(users.id, "usr_manager_001"));

  console.log("✅ Admin PIN updated to 123456");
  process.exit(0);
}

main().catch(console.error);
