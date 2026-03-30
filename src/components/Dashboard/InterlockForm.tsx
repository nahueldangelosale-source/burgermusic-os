"use client";

import { resolveInterlockAction } from "@/actions/resolve-interlock";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

function SubmitButton({ isValid }: { isValid: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !isValid}
      className={`w-full py-4 mt-4 font-black uppercase tracking-widest text-lg transition-all rounded-xl ${
        pending
          ? "bg-red-900/50 text-red-500 cursor-not-allowed"
          : !isValid
            ? "bg-gray-800 text-gray-500 cursor-not-allowed"
            : "bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
      }`}
    >
      {pending ? "Firmando Ledger..." : "Firmar Desbloqueo"}
    </button>
  );
}

export default function InterlockForm({ storeId }: { storeId: string }) {
  const [justification, setJustification] = useState("");
  const isValid = justification.trim().length >= 50;

  const handleAction = async (formData: FormData) => {
    const res = await resolveInterlockAction(formData);
    if (res?.success) {
      toast.success("Ledger Auditado. Mando Global Desbloqueado.");
    } else {
      toast.error(res?.message || "Error en validación Zero-Trust.");
    }
  };

  return (
    <form action={handleAction} className="w-full flex flex-col gap-4">
      <input type="hidden" name="storeId" value={storeId} />

      <div className="relative">
        <textarea
          name="justification"
          rows={4}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Registra tu descargo de responsabilidad operativa detallando los motivos de esta anomalía..."
          className="w-full p-6 pb-12 bg-gray-950 border border-gray-800 rounded-xl text-gray-200 placeholder-gray-700 font-mono focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none"
          required
        />
        <div
          className={`absolute bottom-4 right-4 text-xs font-black tracking-widest ${isValid ? "text-emerald-500" : "text-red-500"}`}
        >
          {justification.length} / 50 CARACTERES
        </div>
      </div>

      <SubmitButton isValid={isValid} />
    </form>
  );
}
