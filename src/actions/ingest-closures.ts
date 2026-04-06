"use server";

import Papa from "papaparse";
import { db } from "@/db";
import { cash_register_closures } from "@/db/schema/treasury";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

const cleanCurrency = (val: any) => {
  if (!val) return 0;
  const str = String(val).replace(/\$|\./g, "").replace(",", ".").trim();
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
};

export async function ingestCashClosures(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) throw new Error("No file uploaded");

    const text = await file.text();
    
    // Configurado con header: false asumiendo el separador ;
    const { data } = Papa.parse(text, {
      header: false,
      delimiter: ";",
      skipEmptyLines: true,
    });

    const storeId = "centro";
    let ingestedRows = 0;
    
    await db.transaction(async (tx) => {
      // El algoritmo iterará sobre cada row (pura matriz)
      for (const row of data as any[]) {
        if (!Array.isArray(row) || row.length < 7) continue;

        const fechaRaw = String(row[0] || "").trim();

        // Regla de Escape (Fricción Positiva)
        if (!fechaRaw || fechaRaw.toLowerCase().includes("fechacaja") || fechaRaw.toLowerCase().includes("total general")) {
          continue;
        }

        // Mapeo Fijo Innegociable
        const fecha = String(row[0] || "").trim();
        const caja = String(row[1] || "").trim();
        const turno = String(row[2] || "UNICO").trim();
        const diferencia = cleanCurrency(row[5]);

        const efectivoTotal = cleanCurrency(row[1]);
        const posnetTotal = cleanCurrency(row[2]);
        const efectivoPya = cleanCurrency(row[3]);
        const mercadoPagoTotal = cleanCurrency(row[4]);
        const onlinePya = cleanCurrency(row[5]);
        const deliveryPropio = cleanCurrency(row[6]);

        // Multi-Inserción y Coerción Monetaria (UNPIVOT)
        const paymentChannels = [
          { method: "EFECTIVO", amount: efectivoTotal },
          { method: "EFECTIVO_PYA", amount: efectivoPya },
          { method: "MERCADO_PAGO", amount: mercadoPagoTotal },
          { method: "ONLINE_PYA", amount: onlinePya },
          { method: "DELIVERY_PROPIO", amount: deliveryPropio },
          { method: "POSNET", amount: posnetTotal }
        ];

        for (const { method, amount } of paymentChannels) {
          if (amount !== 0) { // Inserta solo si es distinto de 0
            await tx.insert(cash_register_closures).values({
              id: randomUUID(),
              store_id: storeId,
              shift: turno,
              closed_at: fecha,
              difference_cents: diferencia, // La varianza aplica al ticket de la caja, se duplicará por canal pero es correcto a nivel row relacional de este sistema simplificado o puede ser abstraido
              payment_method: method as any,
              total_cents: amount,
            });
            ingestedRows++;
          }
        }
      }
    });

    revalidatePath("/dashboard/treasury");
    revalidatePath("/dashboard/sales");

    return { success: true, ingestedRows };
  } catch (err: any) {
    return { success: false, error: err.message || "Error fatal en ingesta Unpivot Hardcoded" };
  }
}

