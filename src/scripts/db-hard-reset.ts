import { execSync } from "child_process";
import { db } from "../db";
import {
  ai_audit_logs,
  inventory_kardex,
  payment_gateways_ledger,
  transactions,
} from "../db/schema";

// Códigos ANSI para colorear el CLI del SRE
const COLORS = {
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  CYAN: "\x1b[36m",
  MAGENTA: "\x1b[35m",
  RESET: "\x1b[0m",
  BOLD: "\x1b[1m",
};

async function runHardReset() {
  console.log(
    `\n${COLORS.MAGENTA}${COLORS.BOLD}⚡ INICIANDO DIRECTIVA ESTRATÉGICA 1: FASE 33.1 ⚡${COLORS.RESET}`,
  );
  console.log(
    `${COLORS.YELLOW}   Operación: Destrucción Creativa y Reinyección de Estado Cero${COLORS.RESET}\n`,
  );

  try {
    console.log(
      `${COLORS.CYAN}1. Iniciando purga transaccional (Estado Inmaculado)...${COLORS.RESET}`,
    );

    await db.transaction(async (tx) => {
      await tx.delete(ai_audit_logs);
      console.log(`${COLORS.GREEN}   ✔ Purga de ai_audit_logs completada.${COLORS.RESET}`);

      await tx.delete(transactions);
      console.log(`${COLORS.GREEN}   ✔ Purga de transactions completada.${COLORS.RESET}`);

      await tx.delete(inventory_kardex);
      console.log(`${COLORS.GREEN}   ✔ Purga de inventory_kardex completada.${COLORS.RESET}`);

      await tx.delete(payment_gateways_ledger);
      console.log(
        `${COLORS.GREEN}   ✔ Purga de payment_gateways_ledger completada.${COLORS.RESET}`,
      );
    });

    console.log(
      `${COLORS.YELLOW}   🔒 Tablas maestras (products, ingredients, mdm_ingredients, bom_recipes, suppliers) INTACTAS.${COLORS.RESET}\n`,
    );

    console.log(
      `${COLORS.CYAN}2. Invocando detonador histórico (fire-historical-sales.ts)...${COLORS.RESET}`,
    );
    execSync("npx tsx --env-file=.env src/scripts/fire-historical-sales.ts", { stdio: "inherit" });

    console.log(
      `\n${COLORS.GREEN}${COLORS.BOLD}🎉 DIRECTIVA 1 COMPLETADA CON ÉXITO: STATE ZERO ALCANZADO. EXIT CODE 0.${COLORS.RESET}\n`,
    );
    process.exit(0);
  } catch (error) {
    console.error(
      `\n${COLORS.RED}${COLORS.BOLD}FALLO CATASTRÓFICO DURANTE EL RESET TRANSACCIONAL:${COLORS.RESET}`,
      error,
    );
    process.exit(1);
  }
}

runHardReset();
