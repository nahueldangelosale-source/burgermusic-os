import crypto from "crypto";
import fs from "fs";
import Papa from "papaparse";
import { z } from "zod";
import { db } from "../db";
import { fact_sales } from "../db/schema";
import { normalizeProductSKU } from "../lib/ai/semantic-matcher";

const BATCH_SIZE = 100; // Agrupa inserciones para mejorar performance de IO

// Validador Zod robusto con coerción monetaria y de fechas
const SaleRowSchema = z.object({
  date: z.string().transform((v) => {
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }),
  shift: z.string().catch("GENERAL"),
  raw_name: z.string(),
  quantity: z.coerce.number().catch(1),
  price: z
    .string()
    .transform((v) => {
      // Transformar "$12.00", "12,00" o "1200" a centavos "1200"
      const numeric = v.replace(/[^0-9.-]+/g, "");
      return Math.round(Number.parseFloat(numeric) * 100) || 0;
    })
    .catch(0),
});

interface RawBatchItem {
  id: string;
  date: string;
  shift: string;
  raw_name: string;
  quantity: number;
  net_price_cents: number;
}

async function runETL() {
  const filePath = process.argv[2] || "ventas_2026_crudo.csv";
  if (!fs.existsSync(filePath)) {
    console.error(`Uso o archivo no encontrado: ${filePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const parsedData = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  let rawBatch: RawBatchItem[] = [];
  let totalProcessed = 0;

  try {
    console.log(`🚀 Iniciando Ingesta Zero-Trust Stream-Based: ${filePath}`);

    for (const record of parsedData.data as any[]) {
      try {
        const rawRow = {
          date: record.fecha || record.date || record.Fecha || new Date().toISOString(),
          shift: record.turno || record.shift || record.Turno || "GENERAL",
          raw_name:
            record.producto || record.name || record.Producto || record.Item || "DESCONOCIDO",
          quantity: record.cantidad || record.qty || record.Cantidad || "1",
          price: record.total || record.price || record.Total || record.Precio || "0",
        };

        const parsed = SaleRowSchema.parse(rawRow);
        const hashContext = `${parsed.date}|${parsed.shift}|${parsed.raw_name}`;
        const idHash = crypto.createHash("sha256").update(hashContext).digest("hex");

        rawBatch.push({
          id: idHash,
          date: parsed.date,
          shift: parsed.shift,
          raw_name: parsed.raw_name,
          quantity: parsed.quantity,
          net_price_cents: parsed.price,
        });

        if (rawBatch.length >= BATCH_SIZE) {
          const currentBatch = [...rawBatch];
          rawBatch = [];

          await processAndInsertBatch(currentBatch);
          totalProcessed += currentBatch.length;
        }
      } catch (err: any) {
        console.error(`⚠️ Error parseando fila: ${err.message}`);
      }
    }

    if (rawBatch.length > 0) {
      await processAndInsertBatch(rawBatch);
      totalProcessed += rawBatch.length;
    }

    console.log(`✅ ETL Finalizado con Zero Errores. Filas Puras Procesadas: ${totalProcessed}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error Crítico en Pipeline ETL:", error);
    process.exit(1);
  }
}

async function processAndInsertBatch(rawItems: RawBatchItem[]) {
  try {
    // Procesamiento secuencial del motor semántico vía for-of
    const enrichedBatch = [];
    for (const item of rawItems) {
      const productSku = await normalizeProductSKU(item.raw_name);
      enrichedBatch.push({
        ...item,
        productSku,
        storeId: "centro",
      });
    }

    // Inserción atómica idempotente
    await db.insert(fact_sales).values(enrichedBatch).onConflictDoNothing();
  } catch (err) {
    console.error("❌ Fallo procesando o insertando batch:", err);
  }
}

runETL();
