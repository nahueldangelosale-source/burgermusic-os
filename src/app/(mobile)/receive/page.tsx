import { db } from "@/db";
import { products, suppliers } from "@/db/schema";
import { BlindReceiveForm } from "./BlindReceiveForm";

export default async function MobileReceivePage() {
  // Edge pre-fetching de catálogo Phantom (sin PO expuesta)
  const sups = await db.select().from(suppliers);
  const rawMaterials = await db.select().from(products);

  // Filtro estático aislando los Insumos/MDM de los productos finales
  const insumos = rawMaterials.filter(
    (p) => !["BURGER", "SIDE", "BEVERAGE", "DESSERT"].includes(p.category || ""),
  );

  return (
    <div className="w-full min-h-screen bg-slate-950 p-6 text-white font-mono flex flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-6 bg-white/5 border border-white/10 p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500/0 via-amber-500 to-amber-500/0" />

        <div className="text-center space-y-1 pb-4 border-b border-white/5">
          <h1 className="text-xl font-bold text-amber-500 tracking-widest">RECEPCIÓN CIEGA</h1>
          <p className="text-[10px] text-slate-500 uppercase">Módulo de Ingreso Físico (Phantom)</p>
        </div>

        <BlindReceiveForm suppliers={sups} ingredients={insumos} />
      </div>
    </div>
  );
}
