import { db } from "../db";
import { products } from "../db/schema";
import { sellable_products } from "../db/schema/bom";
import { eq } from "drizzle-orm";

async function run() {
  // 1. Unificar 'products' (Catálogo Maestro)
  const allProds = await db.select().from(products);
  let mergedCount = 0;
  
  const pGroups: Record<string, typeof allProds> = {};
  for (const p of allProds) {
    const raw = String(p.name || p.id);
    const clean = raw.replace(/^PRD_/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
    if (!pGroups[clean]) pGroups[clean] = [];
    pGroups[clean].push(p);
  }

  for (const [cleanName, items] of Object.entries(pGroups)) {
    if (items.length > 1) {
      const prdItem = items.find(x => x.id.startsWith("PRD_"));
      const normalItem = items.find(x => !x.id.startsWith("PRD_"));
      if (prdItem && normalItem) {
        console.log(`[+] products FUSION: ${prdItem.id} <--- ${normalItem.id} (${cleanName})`);
        await db.update(products).set({
          name: normalItem.name,
          category: normalItem.category,
          targetMargin: normalItem.targetMargin || prdItem.targetMargin,
          base_price_cents: prdItem.base_price_cents || normalItem.base_price_cents
        }).where(eq(products.id, prdItem.id));
        await db.delete(products).where(eq(products.id, normalItem.id));
        mergedCount++;
      } else {
         const master = items[0];
         for(let i=1; i<items.length; i++) {
             console.log(`[-] products BORRADO EXACTO: ${items[i].id}`);
             await db.delete(products).where(eq(products.id, items[i].id));
             mergedCount++;
         }
      }
    }
  }

  // 2. Unificar 'sellable_products' (Vista UI BOM Simulator)
  const allSellable = await db.select().from(sellable_products);
  let sellableMerged = 0;
  const sGroups: Record<string, typeof allSellable> = {};

  for (const s of allSellable) {
    const raw = String(s.id);
    const clean = raw.replace(/^(PROD-|PRD_)/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
    if (!sGroups[clean]) sGroups[clean] = [];
    sGroups[clean].push(s);
  }

  for (const [cleanName, items] of Object.entries(sGroups)) {
    if (items.length > 1) {
      const prdItem = items.find(x => x.id.startsWith("PRD_") || x.sku.startsWith("PRD_"));
      const normalItem = items.find(x => !x.id.startsWith("PRD_") && !x.sku.startsWith("PRD_"));

      if (prdItem && normalItem) {
        console.log(`[+] sellable_products FUSION: ${prdItem.id} <--- ${normalItem.id} (${cleanName})`);
        
        // Delete first to release the UNIQUE constraint on sku
        await db.delete(sellable_products).where(eq(sellable_products.id, normalItem.id));
        
        await db.update(sellable_products).set({
          sku: normalItem.sku !== prdItem.sku ? normalItem.sku : prdItem.sku,
          category: normalItem.category,
          priceCents: prdItem.priceCents || normalItem.priceCents
        }).where(eq(sellable_products.id, prdItem.id));
        
        sellableMerged++;
      } else {
         // Duplicados exactos sin PRD vs Normal
         const master = items[0];
         for(let i=1; i<items.length; i++) {
             console.log(`[-] sellable_products BORRADO: ${items[i].id}`);
             await db.delete(sellable_products).where(eq(sellable_products.id, items[i].id));
             sellableMerged++;
         }
      }
    }
  }

  console.log(`Listo. ${mergedCount} en products. ${sellableMerged} en sellable_products.`);
}

run().catch(console.error);
