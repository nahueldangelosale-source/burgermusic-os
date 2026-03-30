import "dotenv/config"; // Carga .env para el script local
import { db } from "./index"; // Tu conexión exportada
import { type product_unit_enum, products, users } from "./schema";

type ProductUnit = (typeof product_unit_enum)[number];

async function seed() {
  console.log("🌱 Sembrando base de datos...");

  // Limpiamos products existentes para evitar duplicados de IDs viejos
  // (Opcional, pero recomendable en dev)
  try {
    // await db.delete(products); // Descomentar si quieres limpiar
  } catch (e) {}

  const items = [
    {
      id: "CARNE_HAMBURGUESA",
      name: "Carne Hamburguesa",
      unit: "UNIDAD" as ProductUnit,
      synonyms: ["paty", "medallon", "carne", "hamburguesas"],
      isSaleable: false,
    },
    {
      id: "PAN_PAPA",
      name: "Pan de Papa",
      unit: "UNIDAD" as ProductUnit,
      synonyms: ["panes", "buns", "pancho"],
      isSaleable: false,
    },
    {
      id: "QUESO_CHEDDAR",
      name: "Queso Cheddar",
      unit: "UNIDAD" as ProductUnit,
      synonyms: ["cheddar", "queso", "fetras"],
      isSaleable: false,
    },
    {
      id: "TOMATE_REDONDO",
      name: "Tomate Redondo",
      unit: "GRAMOS" as ProductUnit,
      synonyms: ["tomates", "tomatitos"],
      isSaleable: false,
    },
    {
      id: "LECHUGA_CAPUCHINA",
      name: "Lechuga Capuchina",
      unit: "GRAMOS" as ProductUnit,
      synonyms: ["lechuga", "verde"],
      isSaleable: false,
    },
    {
      id: "MEDALLON_POLLO",
      name: "Medallón de Pollo",
      unit: "UNIDAD" as ProductUnit,
      synonyms: ["pollo", "fried chicken", "chicken"],
      isSaleable: false,
    },
    {
      id: "MEDALLON_VEGGIE",
      name: "Medallón Veggie",
      unit: "UNIDAD" as ProductUnit,
      synonyms: ["veggie", "notco", "vegano"],
      isSaleable: false,
    },
    {
      id: "PANCETA",
      name: "Panceta",
      unit: "UNIDAD" as ProductUnit,
      synonyms: ["bacon", "panceta"],
      isSaleable: false,
    },
    {
      id: "PAPAS_FRITAS",
      name: "Porción de Papas Fritas",
      unit: "UNIDAD" as ProductUnit,
      synonyms: ["papas", "fries", "papas fritas"],
      isSaleable: false,
    },
  ];

  await db.insert(products).values(items).onConflictDoNothing();

  // 22 HAMBURGUESAS (Principales para BOM)
  const burgers = [
    {
      id: "CLASIC",
      name: "Clasic",
      unit: "UNIDAD" as ProductUnit,
      isSaleable: true,
      sellingPrice: 850000,
    },
    {
      id: "MALA_FAMA",
      name: "Mala Fama",
      unit: "UNIDAD" as ProductUnit,
      isSaleable: true,
      sellingPrice: 950000,
    },
    {
      id: "ACDC",
      name: "ACDC",
      unit: "UNIDAD" as ProductUnit,
      isSaleable: true,
      sellingPrice: 920000,
    },
    {
      id: "BEATLE",
      name: "Beatle",
      unit: "UNIDAD" as ProductUnit,
      isSaleable: true,
      sellingPrice: 890000,
    },
  ];
  await db.insert(products).values(burgers).onConflictDoNothing();

  // SEMBRAR USUARIOS ESTRATÉGICOS
  const bcrypt = await import("bcryptjs");

  const usersToSeed = [
    {
      id: "carlos_global",
      name: "Carlos Global",
      role: "OWNER_GLOBAL" as const,
      pin: "5678",
      storeId: "centro", // Los dueños ven todo pero su perfil base es centro
    },
    {
      id: "lucia_manager",
      name: "Lucía Manager",
      role: "MANAGER" as const,
      pin: "1111",
      storeId: "centro",
    },
    {
      id: "kitchen_centro",
      name: "Cocina Centro",
      role: "KITCHEN" as const,
      pin: "0000",
      storeId: "centro",
    },
  ];

  for (const u of usersToSeed) {
    const hashedPin = await bcrypt.hash(u.pin, 10);
    await db
      .insert(users)
      .values({
        id: u.id,
        name: u.name,
        role: u.role,
        pin_hash: hashedPin,
        storeId: u.storeId,
      })
      .onConflictDoNothing();
  }

  console.log(
    "✅ Base de datos poblada con Productos, 22 Burgers y Usuarios (Carlos: 5678, Lucía: 1111).",
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Error en seed:", err);
  process.exit(1);
});
