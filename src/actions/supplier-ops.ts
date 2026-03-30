"use server";

import { db } from "@/db";
import { ingredient_quotes, products, suppliers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

// Strict Zod Definition
const SupplierZodSchema = z.object({
  name: z.string().min(2),
  cuit: z.string().min(11),
  contact_info: z.string().optional(),
  category: z.enum(["Insumos", "Servicios", "Mantenimiento", "Otros"]).default("Insumos"),
  paymentTerms: z.string().default("Contado"),
  paymentMethods: z.array(z.string()).default(["TRANSFERENCIA"]),
  invoiceType: z.enum(["FACTURA", "REMITO", "AMBAS"]).default("FACTURA"),
  leadTime: z.number().default(24),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function upsertSupplier(data: z.infer<typeof SupplierZodSchema>) {
  const parsed = SupplierZodSchema.parse(data);

  const result = await db
    .insert(suppliers)
    .values({
      id: uuidv4(),
      name: parsed.name,
      cuit: parsed.cuit,
      contact_info: parsed.contact_info,
      category: parsed.category,
      paymentTerms: parsed.paymentTerms,
      paymentMethods: parsed.paymentMethods,
      invoiceType: parsed.invoiceType,
      leadTime: parsed.leadTime,
      phone: parsed.phone,
      address: parsed.address,
      active: true,
    })
    .onConflictDoUpdate({
      target: suppliers.cuit,
      set: {
        name: parsed.name,
        contact_info: parsed.contact_info,
        category: parsed.category,
        paymentTerms: parsed.paymentTerms,
        paymentMethods: parsed.paymentMethods,
        invoiceType: parsed.invoiceType,
        leadTime: parsed.leadTime,
        phone: parsed.phone,
        address: parsed.address,
      },
    })
    .returning({ id: suppliers.id });

  return { success: true, supplierId: result[0].id };
}

export async function upsertIngredientQuote(
  supplierId: string,
  ingredientSku: string,
  priceCents: number,
) {
  if (!supplierId || !ingredientSku) throw new Error("Parámetros obligatorios faltantes");

  // Coerción matemática obligatoria a Integer
  const safePriceCents = Math.round(Number(priceCents));
  if (isNaN(safePriceCents) || safePriceCents < 0) throw new Error("Precio corrupto o negativo");

  await db
    .insert(ingredient_quotes)
    .values({
      id: uuidv4(),
      supplier_id: supplierId,
      ingredient_sku: ingredientSku,
      price_cents: safePriceCents,
    })
    .onConflictDoUpdate({
      target: [ingredient_quotes.supplier_id, ingredient_quotes.ingredient_sku],
      set: {
        price_cents: safePriceCents,
        updated_at: sql`(strftime('%s', 'now'))`,
      },
    });

  return { success: true };
}

/**
 * Motor Comparativo de Proveedores
 * O(1) en JS de la RAM de Edge (El cómputo pesadísimo Vectorial / Window grouping lo hace SQLite)
 */
export async function getCheapestSuppliers() {
  // SQLite Aggregate / Window Function Approach:
  // Retorna el proveedor más barato para cada ingrediente directamente desde el Engine SQL
  const arbitrageQuery = sql`
        WITH RankedQuotes AS (
            SELECT 
                iq.ingredient_sku,
                p.name as ingredient_name,
                iq.supplier_id,
                s.name as supplier_name,
                iq.price_cents,
                ROW_NUMBER() OVER(PARTITION BY iq.ingredient_sku ORDER BY iq.price_cents ASC) as rnk
            FROM ${ingredient_quotes} iq
            INNER JOIN ${products} p ON p.id = iq.ingredient_sku
            INNER JOIN ${suppliers} s ON s.id = iq.supplier_id
        )
        SELECT 
            ingredient_sku,
            ingredient_name,
            supplier_id,
            supplier_name,
            price_cents
        FROM RankedQuotes WHERE rnk = 1;
    `;

  // Retornamos los objetos resueltos
  const results = await db.all(arbitrageQuery);
  return results;
}

export async function getRawIngredients() {
  try {
    const result = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.isSaleable, false));
    return { success: true, data: result };
  } catch (e: any) {
    console.error(e);
    return { success: false, error: e.message };
  }
}
