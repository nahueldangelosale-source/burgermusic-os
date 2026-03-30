import fs from "fs";
import { db } from "@/db";
import { cash_register_transactions } from "@/db/schema";
import Papa from "papaparse";
import { z } from "zod";

const DinamicaRowZod = z.object({
  FechaCaja: z.string(),
  NroCaja: z.string(),
  Turno: z.string(),
  ImporteApertura: z.number().catch(0),
  ImporteCierre: z.number().catch(0),
  Diferencias: z.number().catch(0),
  ImporteEnCajaCierre: z.number().catch(0),
  CobroEfectivo: z.number().catch(0),
  CobroMercadoPago: z.number().catch(0),
  CobroPosnet: z.number().catch(0),
  CobroPYA: z.number().catch(0),
});

export async function processDinamicaCSV(filePath: string) {
  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    // Regla de Limpieza: Ignora obligatoriamente las primeras 4 filas
    const lines = fileContent.split("\\n");
    if (lines.length <= 4)
      throw new Error(
        "El archivo no contiene suficientes filas para mapear después del salto (4).",
      );

    const cleanCSV = lines.slice(4).join("\\n");

    Papa.parse(cleanCSV, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const inserts: any[] = [];
        for (const r of results.data as any[]) {
          // Safe parsing
          const parsed = DinamicaRowZod.safeParse({
            FechaCaja: String(r["FechaCaja"] || ""),
            NroCaja: String(r["NroCaja"] || ""),
            Turno: String(r["Turno"] || ""),
            ImporteApertura: Number(r["ImporteApertura"] || 0),
            ImporteCierre: Number(r["ImporteCierre"] || 0),
            Diferencias: Number(r["Diferencias"] || 0),
            ImporteEnCajaCierre: Number(r["ImporteEnCajaCierre"] || 0),
            CobroEfectivo: Number(r["Cobro a Clientes x Efectivo"] || 0),
            CobroMercadoPago: Number(r["Cobro a Clientes x Mercado Pago"] || 0),
            CobroPosnet: Number(r["Posnet"] || 0),
            CobroPYA: Number(r["PYA"] || 0),
          });

          if (!parsed.success) continue;

          const row = parsed.data;
          const paymentModes = [
            { method: "CASH", amount: row.CobroEfectivo },
            { method: "MERCADO_PAGO", amount: row.CobroMercadoPago },
            { method: "POSNET", amount: row.CobroPosnet },
            { method: "PYA", amount: row.CobroPYA },
          ];

          // Unpivot O(1)
          for (const pm of paymentModes) {
            inserts.push({
              id: `${row.FechaCaja}_${row.NroCaja}_${row.Turno}_${pm.method}`,
              date: row.FechaCaja,
              registerNum: row.NroCaja,
              shift: row.Turno,
              openingAmount: row.ImporteApertura,
              closingAmount: row.ImporteCierre,
              discrepancy: row.Diferencias,
              cashInRegister: row.ImporteEnCajaCierre,
              paymentMethod: pm.method,
              amount: pm.amount,
            });
          }
        }

        if (inserts.length > 0) {
          await db.transaction(async (tx) => {
            // Idempotencia vía .onConflictDoNothing() configurado en schema.ts compuesto
            await tx.insert(cash_register_transactions).values(inserts).onConflictDoNothing();
          });
          console.log(`✅ ETL completado. ${inserts.length} registros unpivoted inyectados.`);
        }
      },
      error: (err: any) => {
        console.error("Falla crítica en PapaParse:", err);
      },
    });
  } catch (err) {
    console.error("Error en Ingesta Zero-Trust Dinámica:", err);
  }
}
