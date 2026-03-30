"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

export function StoreSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const currentStore = searchParams.get("store") || "";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams);
    if (val) params.set("store", val);
    else params.delete("store");

    startTransition(() => {
      // Re-trigger Server Components fetching without full page physical reload
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="relative">
      <select 
        value={currentStore} 
        onChange={handleChange}
        disabled={isPending}
        className="appearance-none bg-zinc-900/60 border border-zinc-700/50 text-white text-sm font-bold rounded-xl px-5 py-2 pr-10 backdrop-blur-md outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer shadow-lg"
      >
        <option value="">🌎 Global Holding</option>
        <option value="centro">🍔 BurgerMusic Centro</option>
        <option value="norte">🍔 BurgerMusic Norte</option>
      </select>
      {/* Indicador de Transición Asíncrona O(1) */}
      {isPending ? (
        <span className="absolute right-3 top-3 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
        </span>
      ) : (
        <span className="absolute right-3 top-2.5 text-zinc-500 pointer-events-none">▼</span>
      )}
    </div>
  );
}
