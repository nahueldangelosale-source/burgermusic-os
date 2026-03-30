"use server";

import * as xlsx from "xlsx";
import { db } from "@/db";
import { fact_sales, cash_register_transactions, sales_mapping_dlq, products, syncState } from "@/db/schema";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ExcelRowSchema } from "@/schemas/transactions";
import { eq } from "drizzle-orm";
import { authenticatedAction } from "@/lib/auth-action";
import { withTenant } from "@/lib/tenant-db";
import { z } from "zod";

/**
 * SRE ZERO-TRUST INPUT SCHEMAS
 * Estándar Antigravity 2026
 */
const IngestionInputSchema = z.object({
  file: z.instanceof(File, { message: "Archivo inválido o ausente." }),
  syncKey: z.string().min(1, "syncKey es obligatorio para asegurar idempotencia."),
  mapping: z.string().optional().transform((v) => {
    try {
      return v ? JSON.parse(v) : { cantidad: 0, precio: 1, nroCaja: 2, fecha: 3, descripcion: 4 };
    } catch {
      return { cantidad: 0, precio: 1, nroCaja: 2, fecha: 3, descripcion: 4 };
    }
  }),
});

export async function extractExcelHeaders(formData: FormData): Promise<{ success: boolean; headers?: string[]; sampleData?: any[]; error?: string }> {
  try {
    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "Archivo no encontrado en FormData." };

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { defval: "", header: 1, raw: true });

    if (rawData.length === 0) return { success: false, error: "El archivo Excel está vacío." };

    // Evitar falsos positivos buscando la primera fila densa
    let headerRow = rawData[0];
    for (const row of rawData) {
       if (row && row.length >= 3) {
         headerRow = row;
         break;
       }
    }

    const headers = headerRow.map((val: any, idx: number) => val ? String(val).substring(0, 30) : `Columna ${idx}`);
    const sampleData = rawData.length > 1 ? rawData.slice(1, 4) : [];

    return { success: true, headers, sampleData };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export const ingestDynamicExcel = authenticatedAction(async (formData: FormData, { user }) => {
  /**
   * ═══════════════════════════════════════════════════
   * 1. ZERO-TRUST INPUT VALIDATION & SHADOWING
   * ═══════════════════════════════════════════════════
   */
  const inputValidation = IngestionInputSchema.safeParse({
    file: formData.get("file"),
    syncKey: formData.get("syncKey"),
    mapping: formData.get("mapping"),
  });

  if (!inputValidation.success) {
    return { success: false, error: `Error de validación: ${inputValidation.error.message}` };
  }

  const { file, syncKey, mapping: map } = inputValidation.data;
  const VALID_STORE_ID: string = user.storeId;
  const tenant = withTenant({ user });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const rawData = xlsx.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { defval: "", header: 1, raw: true });
  
  // 2. Idempotencia: Verificar si ya se procesó este lote
  const existingSync = await tenant.select()
    .from(syncState)
    .where(eq(syncState.syncKey, syncKey));

  if (existingSync.length > 0) {
    return { success: false, error: "Detección de duplicado: Este lote ya fue procesado." };
  }

  // 3. O(1) Diccionario de Productos (Caché en Memoria para este Action)
  const allProducts = (await tenant.select({ id: products.id, name: products.name }).from(products)) as { id: string; name: string }[];
  const productDictionary = new Map<string, string>();
  const normalize = (s: string) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase().trim();

  for (const p of allProducts) {
      const name = p.name;
      const id = p.id;
      productDictionary.set(normalize(name), id);
      productDictionary.set(normalize(id.replace(/^(PRD_|PROD-)/i, '')), id);
  }

  const hydratedRows: any[] = [];
  let memoryFecha: string | number = "";
  let memoryCaja = "-";
  let deadLetters = 0;

  for (let i = 0; i < rawData.length; i++) {
     const row = rawData[i];
     if (!Array.isArray(row)) continue;
     
     const desc = String(row[map.descripcion] || "").trim();
     const finalQty = (row[map.cantidad] === "" || row[map.cantidad] === undefined) ? 1 : row[map.cantidad];
     const priceVal = (row[map.precio] === "" || row[map.precio] === undefined) ? 0 : row[map.precio];
     
     if (desc.toUpperCase().includes("TOTAL") || desc.toUpperCase().includes("RESULTADO")) {
         deadLetters++;
         continue;
     }
     
     if (!desc) continue;
     if (i === 0 && isNaN(Number(String(row[map.precio]).replace(/[,.$]/g,'')))) continue;

     if (row[map.fecha]) memoryFecha = row[map.fecha];
     if (row[map.nroCaja]) memoryCaja = String(row[map.nroCaja]).trim();

     hydratedRows.push({
       cantidad: finalQty,
       precio: priceVal,
       nroCaja: memoryCaja,
       fecha: memoryFecha,
       descripcion: desc
     });
  }

  const validPayload: (typeof fact_sales.$inferInsert)[] = [];
  const dlqPayload: (typeof sales_mapping_dlq.$inferInsert)[] = [];
  const cashMap = new Map<string, typeof cash_register_transactions.$inferInsert>();
  const autoLinkProducts: (typeof products.$inferInsert)[] = [];
  const createdSkus = new Set<string>();
  
  let latestDateStr = "1970-01-01";

  for (const hydrated of hydratedRows) {
     const parsed = ExcelRowSchema.safeParse(hydrated);
     
     /**
      * ═══════════════════════════════════════════════════
      * 4. ZERO-TRUST DLQ REDIRECTION (FIX Línea 132)
      * ═══════════════════════════════════════════════════
      */
     if (!parsed.success) {
       deadLetters++;
       dlqPayload.push({
           id: randomUUID(),
           storeId: VALID_STORE_ID,
           raw_name: typeof hydrated.descripcion === "string" ? hydrated.descripcion : "NO_DESC",
           quantity: typeof hydrated.cantidad === "number" ? hydrated.cantidad : 1,
           price: typeof hydrated.precio === "number" ? Math.round(hydrated.precio * 100) : 0,
           resolved: false,
       });
       continue;
     }

     const { cantidad, precio, nroCaja, fecha, descripcion } = parsed.data;
     if (fecha > latestDateStr) latestDateStr = fecha;
     const netPriceCents = Math.round(precio * 100);
     
     const normDesc = normalize(descripcion);
     let realSku = productDictionary.get(normDesc);
     
     if (!realSku) {
         const cleanId = "PRD_AUTO_" + String(normDesc).toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 25);
         if (!createdSkus.has(cleanId)) {
             autoLinkProducts.push({
                 id: cleanId,
                 sku: cleanId.replace('PRD_', 'SKU-'),
                 name: String(descripcion).trim().substring(0, 50),
                 category: "BURGER",
                 item_type: "MANUFACTURED",
                 isSaleable: true,
                 base_price_cents: netPriceCents > 0 ? Math.round(netPriceCents / Math.max(1, Number(cantidad))) : 0,
                 sellingPrice: netPriceCents > 0 ? Math.round(netPriceCents / Math.max(1, Number(cantidad))) : 0,
              });
             createdSkus.add(cleanId);
             productDictionary.set(normDesc, cleanId);
         }
         realSku = cleanId;
     }

     validPayload.push({
         id: randomUUID(),
         date: fecha,
         shift: "UNKNOWN",
         raw_name: descripcion,
         productSku: realSku,
         quantity: cantidad,
         net_price_cents: netPriceCents,
         storeId: VALID_STORE_ID,
      });

     const hashKey = `${fecha}-${nroCaja}-UNKNOWN-MIXTO`;
     if (!cashMap.has(hashKey)) {
         cashMap.set(hashKey, {
             id: randomUUID(),
             date: fecha,
             shift: "UNKNOWN",
             registerNum: nroCaja,
             paymentMethod: "MIXTO",
             amount: 0,
             openingAmount: 0,
             closingAmount: 0,
             discrepancy: 0,
             cashInRegister: 0,
             storeId: VALID_STORE_ID,
          });
     }
     const entry = cashMap.get(hashKey);
     if (entry) {
        entry.amount += netPriceCents;
        entry.cashInRegister += netPriceCents;
     }
  }

  // 5. ATOMIC DB PUSH (CHUNKING)
  const CHUNK_SIZE = 1500;
  if (autoLinkProducts.length > 0) {
      for (let i = 0; i < autoLinkProducts.length; i += CHUNK_SIZE) {
          await tenant.insert(products).values(autoLinkProducts.slice(i, i + CHUNK_SIZE)).onConflictDoNothing();
      }
  }

  for (let i = 0; i < validPayload.length; i += CHUNK_SIZE) {
      await tenant.insert(fact_sales).values(validPayload.slice(i, i + CHUNK_SIZE)).onConflictDoNothing();
  }
  
  if (dlqPayload.length > 0) {
      for (let i = 0; i < dlqPayload.length; i += CHUNK_SIZE) {
          await tenant.insert(sales_mapping_dlq).values(dlqPayload.slice(i, i + CHUNK_SIZE)).onConflictDoNothing();
      }
  }
  
  const cashBatch = Array.from(cashMap.values());
  for (let i = 0; i < cashBatch.length; i += CHUNK_SIZE) {
      await tenant.insert(cash_register_transactions).values(cashBatch.slice(i, i + CHUNK_SIZE)).onConflictDoNothing();
  }

  // Idempotencia: Registrar estado de sincronización
  await tenant.insert(syncState).values([{
    syncKey,
    lastSyncedRow: rawData.length,
  }]).onConflictDoNothing();

  revalidatePath("/dashboard/sales");
  return { 
    success: true,
    inserted: validPayload.length, 
    deadLetters,
    targetDate: latestDateStr 
  };
});
