import { getUnresolvedOrphans } from "@/actions/alias-engine";
import { AliasResolutionCenter } from "./AliasResolutionCenter";

export const dynamic = "force-dynamic";

export default async function AliasResolutionPage() {
  const { orphans, products } = await getUnresolvedOrphans();

  return (
    <div className="bg-[oklch(0.98_0.01_250)] min-h-screen p-6 md:p-8 text-slate-900 font-sans selection:bg-indigo-500/10">
      <header className="mb-10 flex items-center gap-4 border-b border-slate-200 pb-8">
        <div className="w-4 h-8 bg-amber-500 rounded-sm shadow-sm shadow-amber-500/20" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 uppercase">
            Alias Resolution Center
          </h1>
          <p className="text-slate-500 font-bold text-sm mt-1 uppercase tracking-tighter">
            Motor Heurístico de Auto-Resolución • SKUs Huérfanos
          </p>
        </div>
      </header>

      <AliasResolutionCenter
        initialOrphans={orphans}
        initialProducts={products}
      />
    </div>
  );
}
