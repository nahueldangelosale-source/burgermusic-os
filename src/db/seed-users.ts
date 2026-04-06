/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║    GÉNESIS: CAPITAL HUMANO — Inyección de Usuario Maestro                  ║
 * ║    BurgerMusic OS v4.2 — Rehidratación SRE                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { db } from "./index"; 
import { users } from "./schema"; 
import crypto from "node:crypto";

async function seedMasterTenant() {
  try {
    console.log("🌱 [SEED] Iniciando Génesis Criptográfico del Capital Humano...");
    
    await db.insert(users).values({
      id: crypto.randomUUID(),
      email: "admin@burgermusic.com",
      storeId: "STR_DEFAULT",
      role: "MANAGER_LOCAL",
      passwordHash: "1234", // Password plana/hash básico solo para entorno Dev/Seed
      name: "C-Level Manager"
    }).onConflictDoNothing();

    console.log("🟢 Exit Code 0: C-Level Manager inyectado exitosamente en Turso DB.");
    process.exit(0);
  } catch (error: any) {
    console.error("🔴 Exit Code 1: Falla catastrófica en el Seed de Usuarios.", error.message || error);
    process.exit(1);
  }
}

seedMasterTenant();
