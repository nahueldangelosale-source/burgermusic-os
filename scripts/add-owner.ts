import "dotenv/config";
import * as bcrypt from "bcryptjs";
import { db } from "../src/db/index";
import { users } from "../src/db/schema";

async function addOwner() {
  console.log("👤 Agregando Owner Global...");
  const hashedPin = await bcrypt.hash("5678", 10);

  await db
    .insert(users)
    .values({
      id: "global_owner",
      name: "Carlos Global",
      role: "OWNER_GLOBAL",
      pin_hash: hashedPin,
      storeId: "all", // Global access
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { role: "OWNER_GLOBAL", pin_hash: hashedPin },
    });

  console.log("✅ Owner Global (PIN: 5678) agregado exitosamente.");
  process.exit(0);
}

addOwner().catch(console.error);
