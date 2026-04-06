"use server";

import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";

function slugify(text: string) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export async function createProductInline(name: string, category: string) {
  const slug = slugify(name);
  const prefix = category === 'Servicio' ? 'SRV' : 'PDR';
  const id = `${prefix}_${slug}`;

  // Check existence first
  const existingProduct = await db.select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (existingProduct.length > 0) {
    return existingProduct[0];
  }

  // Inyección atómica si no existe
  const result = await db.insert(products).values({
    id,
    name,
    category,
    costCents: 0,
  }).returning({ id: products.id, name: products.name });

  return result[0];
}
