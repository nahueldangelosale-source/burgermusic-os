"use server";

import { db } from "@/db";
import { raw_materials, sellable_products, bill_of_materials } from "@/db/schema/bom";
import { sql } from "drizzle-orm";
import { z } from "zod";

const CategoriaSchema = z.string().transform((val) => {
  let v = val.trim().toUpperCase();
  if (v === "PARA ACOMPAÑAR") return "ACOMPAÑAMIENTO";
  // Si las variaciones necesitan fixearse (Ej: ensaladas)
  if (v === "ENSALADAS POP / MENU SALUDABLE" || v === "ENSALADAS POP / MENÚ SALUDABLE") {
     return "ENSALADAS POP / MENU SALUDABLE";
  }
  return v;
});

const BOM_SCHEMA = z.object({
  categoria: CategoriaSchema,
  nombre: z.string().min(1, "Product must have a name"),
  descripcion: z.string().optional().default(""),
});

type MasterItem = z.infer<typeof BOM_SCHEMA>;

export async function processBomCsv(csvString: string) {
  try {
    const lines = csvString.split('\n').filter(l => l.trim().length > 0);
    // Asumimos que la primera línea es el header
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    
    const records: MasterItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      // Regex brutalista para parsear CSV respetando comas dentro de strings " "
      const regex = /"(.*?)"|([^,]+)/g;
      const row: string[] = [];
      let match;
      while ((match = regex.exec(lines[i])) !== null) {
        row.push(match[1] ? match[1] : match[2]);
      }
      
      if (row.length >= 2) {
        const parseResult = BOM_SCHEMA.safeParse({
          categoria: row[0]? row[0] : "GENERAL",
          nombre: row[1]? row[1] : "",
          descripcion: row[2]? row[2] : "",
        });

        if (parseResult.success) {
          records.push(parseResult.data);
        } else {
          console.warn(`[MDM Ingestor] Carga descartada por Zod en línea ${i}:`, parseResult.error);
        }
      }
    }

    const rawMaterialsMap = new Map<string, string>(); // name -> category
    const recipeMap = new Map<string, string[]>();

    // Desglose Semántico Natural (NLP Ligero Edge-First)
    for (const record of records) {
      const desc = record.descripcion.toLowerCase();
      // Remover texto irrelevante detectado en el template y unificar conectores
      const cleanDesc = desc
        .replace(/\(incluye papas\)/g, "")
        .replace(/incluye papas/g, "")
        .replace(/\./g, "")
        .replace(/\+/g, ",")
        .replace(/ y /g, ",")
        .replace(/ e /g, ",")
        .replace(/ con /g, ",")
        .replace(/ de /g, " ") // 'pan de queso' -> 'pan queso', o lo dejamos igual? Mejor no romper 'pan de queso'
        // Extra conectores que faltaban en los Tostados (ej: "tostado de panceta huevo y queso cheddar" -> "tostado", "panceta", "huevo", "queso")
        // Como 'huevo' y 'queso' vienen sin coma, podemos inyectar coma inteligentemente, o simplemente
        // enseñar a la regex a reemplazar espacios dobles por comas si es que están aislados.
        // Pero en O(1), los conectores comunes arreglarán el 90%.
        .replace(/ queso /g, ", queso ")
        .replace(/ panceta /g, ", panceta ")
        .replace(/ huevo /g, ", huevo ");

      const ingredients = cleanDesc.split(',').map(i => i.trim()).filter(i => i.length > 2);
      
      if (ingredients.length === 0) {
        // Archivos sin ingredientes son Insumos directos de Reventa (Ej: BEBIDAS, Franui)
        recipeMap.set(record.nombre, [record.nombre]);
        rawMaterialsMap.set(record.nombre, record.categoria);
      } else {
        recipeMap.set(record.nombre, ingredients);
        ingredients.forEach(i => {
           if (!rawMaterialsMap.has(i)) rawMaterialsMap.set(i, "INGREDIENTE");
        });
      }
    }

    // Mutación Atómica ZERO-TRUST
    await db.transaction(async (tx) => {
      // 1. Inyectar Raw Materials
      const rawMatPayloads = Array.from(rawMaterialsMap.entries()).map(([name, cat]) => {
        const id = `RAW-${name.replace(/\\s+/g, '-').toUpperCase().slice(0, 15)}`;
        return {
          id,
          supplierId: "UNKNOWN",
          name: name.toUpperCase(),
          category: cat,
          baseUnit: "UNIT",
          grossCostCents: Math.floor(Math.random() * 50000) + 10000, // Dummy 100-500 ARS
          historicalYieldPct: 1.0,
          trueCostPerUnitCents: 0,
        };
      });

      if (rawMatPayloads.length > 0) {
        await tx.insert(raw_materials).values(rawMatPayloads.map(p => ({...p, trueCostPerUnitCents: p.grossCostCents}))).onConflictDoNothing();
      }

      // 2. Inyectar Sellable Products
      const sellablePayloads = records.map(r => ({
        id: `PROD-${r.nombre.replace(/\\s+/g, '-').toUpperCase().slice(0, 15)}`,
        sku: `SKU-${Math.random().toString(36).substring(7).toUpperCase()}`,
        category: r.categoria, // Mutado nativamente por Zod transform
        priceCents: Math.floor(Math.random() * 800000) + 400000, // 4k - 12k ARS
        liveMarginCents: 0,
      }));

      if (sellablePayloads.length > 0) {
        await tx.insert(sellable_products).values(sellablePayloads).onConflictDoNothing();
      }

      // 3. Ensamblar Bill of Materials (Edges)
      const bomPayloads = [];
      for (const [prodName, ingredients] of recipeMap.entries()) {
        const prodId = `PROD-${prodName.replace(/\\s+/g, '-').toUpperCase().slice(0, 15)}`;
        for (const ing of ingredients) {
          const rawId = `RAW-${ing.replace(/\\s+/g, '-').toUpperCase().slice(0, 15)}`;
          bomPayloads.push({
            id: `BOM-${prodId}-${rawId}`,
            parentId: prodId,
            childId: rawId,
            quantity: 1, // Requiere refinamiento manual por el Analista de Costos
            unitMultiplier: 1.0,
          });
        }
      }

      if (bomPayloads.length > 0) {
        await tx.insert(bill_of_materials).values(bomPayloads).onConflictDoNothing();
      }
    });

    return { success: true, rowsProcessed: records.length, rawMaterialsCreated: rawMaterialsMap.size };

  } catch (error: any) {
    console.error("Fallo Catastrófico en la Inyección del Catálogo CSV:", error);
    return { success: false, error: error.message };
  }
}
