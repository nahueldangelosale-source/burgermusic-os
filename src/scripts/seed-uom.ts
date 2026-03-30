import crypto from "crypto";
import { z } from "zod";
import { db } from "../db";
import { uomConversions } from "../db/schema/uom";

// Tipaje Estricto para Coerción Dimensional (Gastronómica) Base
const StandardUnits = z.enum(["GR", "ML", "UNIT"]);

const UomPairSchema = z.object({
  fromUnit: z.string(),
  toBaseUnit: StandardUnits,
  multiplier: z.number().positive(),
});

// Contratos Gastronómicos Zero-Trust
const defaultConversions = [
  { fromUnit: "KG", toBaseUnit: "GR", multiplier: 1000.0 },
  { fromUnit: "L", toBaseUnit: "ML", multiplier: 1000.0 },
  { fromUnit: "BOX_20KG", toBaseUnit: "GR", multiplier: 20000.0 },
  { fromUnit: "SAUCE_10L", toBaseUnit: "ML", multiplier: 10000.0 },
  { fromUnit: "BUN_PACK_4", toBaseUnit: "UNIT", multiplier: 4.0 },
  { fromUnit: "BUN_PACK_12", toBaseUnit: "UNIT", multiplier: 12.0 },
  { fromUnit: "PANCETA_SLAB_5KG", toBaseUnit: "GR", multiplier: 5000.0 },
];

async function seedUom() {
  console.log("🚀 Iniciando Seed de Matriz de Coerción Dimensional O(1) con Idempotencia Fija");

  try {
    for (const raw of defaultConversions) {
      // 1. Zod Semantic Checks
      const parsed = UomPairSchema.parse(raw);

      // 2. Firmado de la Clave Criptográfica Determinística
      const deterministicId = crypto
        .createHash("sha256")
        .update(`${parsed.fromUnit}_TO_${parsed.toBaseUnit}`)
        .digest("hex");

      // 3. Empuje a Turso por onConflictDoUpdate garantizando Cero Duplicados en corridas CICD
      await db
        .insert(uomConversions)
        .values({
          id: deterministicId,
          fromUnit: parsed.fromUnit,
          toBaseUnit: parsed.toBaseUnit,
          multiplier: parsed.multiplier,
        })
        .onConflictDoUpdate({
          target: uomConversions.id,
          set: { multiplier: parsed.multiplier },
        });

      console.log(
        `✅ Upsert Exitoso UOM O(1): ${parsed.fromUnit} -> [x ${parsed.multiplier}] ${parsed.toBaseUnit}`,
      );
    }

    console.log("🏁 Seed de UOM Finalizado Rigurosamente (Exit Code: 0)");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Fallo Crítico SRE en Seed Matriz UOM:", err);
    process.exit(1);
  }
}

seedUom();
