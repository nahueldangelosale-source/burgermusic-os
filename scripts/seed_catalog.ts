import { db } from "../src/db";
import { products } from "../src/db/schema";
import { sql, eq } from "drizzle-orm";

const newProducts = [
  { cat: "HAMBURGUESAS", name: "CLASSIC", price: 11100 },
  { cat: "HAMBURGUESAS", name: "DUKO", price: 13100 },
  { cat: "HAMBURGUESAS", name: "CHARLY", price: 11700 },
  { cat: "HAMBURGUESAS", name: "MALA FAMA", price: 14200 },
  { cat: "HAMBURGUESAS", name: "HC (Hernán Cattáneo)", price: 14200 },
  { cat: "HAMBURGUESAS", name: "RESIDENTE", price: 14200 },
  { cat: "HAMBURGUESAS", name: "BOB MARLEY", price: 12100 },
  { cat: "HAMBURGUESAS", name: "KISS", price: 12900 },
  { cat: "HAMBURGUESAS", name: "ROLLING STONES", price: 12300 },
  { cat: "HAMBURGUESAS", name: "RED HOT", price: 12800 },
  { cat: "HAMBURGUESAS", name: "THE BEATLES", price: 12600 },
  { cat: "HAMBURGUESAS", name: "AC/DC", price: 13200 },
  { cat: "HAMBURGUESAS", name: "FRIED ONION", price: 12800 },
  { cat: "HAMBURGUESAS", name: "TECHNO CHICKEN", price: 10700 },
  { cat: "HAMBURGUESAS", name: "GORILLAZ", price: 13800 },
  { cat: "HAMBURGUESAS", name: "MADONNA Veggie", price: 12300 },
  { cat: "HAMBURGUESAS", name: "PATRICIO REY", price: 13500 },
  { cat: "HAMBURGUESAS", name: "ALMA FUERTE pulled pork", price: 13500 },
  { cat: "HAMBURGUESAS", name: "BIZARRAP Session #1", price: 10500 },
  { cat: "HAMBURGUESAS", name: "BIZARRAP Session #2", price: 10500 },
  { cat: "HAMBURGUESAS", name: "Eminem", price: 17600 },
  
  { cat: "MENU INFANTIL", name: "KIDS ROCK", price: 7500 },
  
  { cat: "PARA ACOMPAÑAR", name: "Papas QUEEN", price: 8800 },
  { cat: "PARA ACOMPAÑAR", name: "Papas Cheddar", price: 8700 },
  { cat: "PARA ACOMPAÑAR", name: "Papas MERCURY", price: 12200 },
  { cat: "PARA ACOMPAÑAR", name: "Aros de cebolla + papas", price: 8600 },
  { cat: "PARA ACOMPAÑAR", name: "Nuggets de pollo + papas", price: 9000 },
  { cat: "PICADAS BEAT", name: "FREESTYLE", price: 21600 },
  
  { cat: "ENSALADAS POP / MENU SALUDABLE", name: "RIHANNA", price: 10500 },
  { cat: "ENSALADAS POP / MENU SALUDABLE", name: "LADY GAGA", price: 10500 },
  
  { cat: "POSTRES", name: "Franui", price: 9000 },
  
  { cat: "TOSTADOS", name: "tostado americano + levite", price: 6800 },
  { cat: "TOSTADOS", name: "tostado clasico + levite", price: 6800 },
  { cat: "TOSTADOS", name: "X2 tostado americano", price: 9500 },
  { cat: "TOSTADOS", name: "X2 tostado clasico", price: 9500 },
  
  { cat: "BEBIDAS", name: "villavicencio 500cc", price: 2100 },
  { cat: "BEBIDAS", name: "Coca Cola 1.5 lts", price: 5300 },
  { cat: "BEBIDAS", name: "Coca Cola Zero 1.5 Lts", price: 5300 },
  { cat: "BEBIDAS", name: "SpriTe 1.5 lts", price: 5300 },
  { cat: "BEBIDAS", name: "lata Sprite 354cc", price: 2500 },
  { cat: "BEBIDAS", name: "lata Coca-Cola zero", price: 2500 },
  { cat: "BEBIDAS", name: "lata Coca-Cola 354cc", price: 2500 },
  { cat: "BEBIDAS", name: "Levite de naranja 500ml", price: 2100 },
  { cat: "BEBIDAS", name: "Levite de manzana 500ml", price: 2100 },
  { cat: "BEBIDAS", name: "Levite de pomelo 500ml", price: 2100 },
  { cat: "BEBIDAS", name: "Levite de pomelo 1.5lt", price: 2800 },
  { cat: "BEBIDAS", name: "Levite de manzana 1.5 lts", price: 2800 },
  { cat: "BEBIDAS", name: "Cerveza Heineken Lata 473cc", price: 4500 },
  { cat: "BEBIDAS", name: "Andes Rubia Lata 473cc", price: 4000 },
  { cat: "BEBIDAS", name: "Andes IPA Lata 473cc", price: 4000 },
  { cat: "BEBIDAS", name: "Andes Roja Lata 473cc", price: 4000 },
  { cat: "BEBIDAS", name: "Stella artois lata", price: 4500 },
  { cat: "BEBIDAS", name: "Lata Schweppes Pomelo Zero", price: 2500 },
  
  { cat: "PIZZAS XL", name: "John Lennon", price: 16000 },
  { cat: "PIZZAS XL", name: "Pink Floyd", price: 19000 },
  { cat: "PIZZAS XL", name: "Elvis Presley", price: 27000 },
  { cat: "PIZZAS XL", name: "Michael Jackson", price: 18000 },
  { cat: "PIZZAS XL", name: "Creedence", price: 21000 },
  { cat: "PIZZAS XL", name: "Mick Jagger mediana", price: 19000 },
  { cat: "PIZZAS XL", name: "Freddie Mercury", price: 21000 },
  { cat: "PIZZAS XL", name: "KISS (Pizza)", price: 18000 },
  { cat: "PIZZAS XL", name: "Led Zeppelin", price: 21000 },
  { cat: "PIZZAS XL", name: "Johnny Rivers", price: 19000 },
  
  { cat: "EMPANADAS", name: "Empanada Carne", price: 2500 },
  { cat: "EMPANADAS", name: "Empanada Pollo", price: 2500 },
  { cat: "EMPANADAS", name: "Empanada Cebolla y queso", price: 2500 },
  { cat: "EMPANADAS", name: "Empanada Jamon y queso", price: 2500 },
  { cat: "EMPANADAS", name: "Empanada Verdura", price: 2500 },
  { cat: "EMPANADAS", name: "Empanada Caprese", price: 2500 },
  
  { cat: "PROMOS", name: "PROMO 1 -- 4 X Classic simple", price: 44400 }
];

async function seed() {
  console.log("Starting Catalog Hard-Reset...");
  
  // Instead of deleting (which violates FK constraints on historical orders), we disable all existing
  await db.update(products).set({ isSaleable: false });
  console.log("Marked all current products as non-saleable.");

  const bulkInsert = newProducts.map(p => {
    let rawId = p.name.toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 30);
    // Anti-collision for KISS Pizza vs KISS Burger
    if (p.name.includes("(Pizza)")) rawId = "PRD_PIZZA_KISS";
    else if (p.name.includes("Empanada")) rawId = "PRD_EMP_" + rawId.replace("EMPANADA_", "");
    else rawId = "PRD_" + rawId;

    return {
      id: rawId,
      sku: rawId.replace('PRD_', 'SKU-'),
      name: p.name,
      category: p.cat,
      isSaleable: true,
      base_price_cents: p.price * 100,
      sellingPrice: p.price * 100,
      description: "Canonical SKU (2026)"
    };
  });

  // UPSERT the new canonical items
  for (const item of bulkInsert) {
     const exists = await db.select().from(products).where(eq(products.id, item.id));
     if (exists.length > 0) {
       await db.update(products).set(item).where(eq(products.id, item.id));
     } else {
       await db.insert(products).values(item);
     }
  }

  console.log(`Successfully injected ${bulkInsert.length} canonical SKUs.`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
