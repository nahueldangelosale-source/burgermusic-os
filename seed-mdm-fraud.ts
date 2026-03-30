import { eq } from "drizzle-orm";
import { db } from "./src/db";
import { products } from "./src/db/schema";

async function main() {
  console.log("🌱 Inyectando data MDM para prueba de Fraude/Shrinkflation...");

  // Vamos a usar el "id" = "PRD-CARNE-PICADA"
  const existing = await db.select().from(products).where(eq(products.id, "PRD-CARNE-PICADA"));

  // Si no existe, lo creamos con un coste de 1000 pesos (100000 centavos)
  if (existing.length === 0) {
    await db.insert(products).values({
      id: "PRD-CARNE-PICADA",
      name: "Carne Picada Premium",
      unit: "GRAMOS",
      costCents: 100000,
      isSaleable: false,
    });
    console.log("✅ Producto inyectado con precio de $1000.");
  } else {
    await db.update(products).set({ costCents: 100000 }).where(eq(products.id, "PRD-CARNE-PICADA"));
    console.log("✅ Producto actualizado con precio de $1000.");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Error seeding MDM:", e);
  process.exit(1);
});
