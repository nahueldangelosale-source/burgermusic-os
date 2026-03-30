import { db } from "@/db";
import { raw_materials } from "@/db/schema/bom";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InventoryKitchenClient } from "./InventoryKitchenClient";

export default async function KitchenInventoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Zero-Trust Fetching: Solo data de catálogo, PROHIBIDO traer stock (Kardex)
  const materials = await db
    .select({
      id: raw_materials.id,
      name: raw_materials.name,
      category: raw_materials.category,
      purchaseUnit: raw_materials.purchaseUnit,
    })
    .from(raw_materials);

  const groupedMaterials = materials.reduce((acc, curr) => {
    const cat = curr.category || "GENERAL";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(curr);
    return acc;
  }, {} as Record<string, typeof materials>);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-4 md:p-8 lg:p-12 pb-32">
      <header className="mb-8">
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">
          Cierre de Inventario <span className="text-accent-primary">Cocina</span>
        </h1>
        <p className="text-slate-400 font-medium">
          Declara el stock físico actual. El conteo debe ser <span className="text-white font-bold underline">CIEGO</span>.
        </p>
      </header>

      <InventoryKitchenClient 
        groupedMaterials={groupedMaterials} 
        storeId={session.user.storeId}
        reportedBy={session.user.name}
      />
    </div>
  );
}
