"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Landmark } from "lucide-react";
import { ingestCashClosures } from "@/actions/ingest-closures";

export function AirlockFinanciero() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleClosuresUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    try {
      const res = await ingestCashClosures(formData);
      if (res.error) {
        toast.error("Error Cierres: " + res.error);
      } else {
        toast.success(`✅ Cierres: ${res.ingestedRows ?? 0} filas financieras ingestadas.`);
        router.refresh();
      }
    } catch (err: any) {
      toast.error("Error Cierres: " + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all group max-w-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
          <Landmark size={18} />
        </div>
        <div>
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Airlock Financiero</h3>
          <p className="text-[10px] text-slate-400 font-bold tracking-wide">Dinámica.csv • Zero Fricción</p>
        </div>
      </div>
      <label className={`cursor-pointer w-full block text-center px-4 py-3 text-sm font-bold rounded-xl transition-all ${isUploading ? "opacity-50 pointer-events-none bg-emerald-50 text-emerald-400 border border-emerald-200" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20"}`}>
        <span>{isUploading ? "Ingestando Dinámica..." : "Seleccionar CSV Financiero"}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={handleClosuresUpload}
          disabled={isUploading}
        />
      </label>
    </div>
  );
}
