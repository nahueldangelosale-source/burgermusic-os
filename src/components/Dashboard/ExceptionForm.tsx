"use client";

import { resolveExceptionAction } from "@/actions/resolve-exception";
import { Loader2, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

/**
 * Positive Friction Button - React 18
 */
function SubmitButton({ isValid }: { isValid: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || !isValid}
      className={`
        w-full py-4 mt-6 rounded-xl font-black uppercase tracking-widest transition-all
        disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-md
        ${
          pending
            ? "bg-gray-200 text-gray-500 opacity-80"
            : !isValid
              ? "bg-gray-100 text-gray-400 opacity-50"
              : "bg-gray-900 text-white hover:bg-gray-800 hover:shadow-lg"
        }
      `}
    >
      {pending ? (
        <>
          <Loader2 size={20} className="animate-spin" />
          Auditando Discrepancia...
        </>
      ) : (
        <>
          <ShieldCheck size={20} />
          Registrar en Ledger y Desbloquear
        </>
      )}
    </button>
  );
}

export default function ExceptionForm({ storeId }: { storeId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [justification, setJustification] = useState("");
  const isValid = justification.trim().length > 20;

  const handleAction = async (formData: FormData) => {
    try {
      const res = await resolveExceptionAction(formData);
      if (res.success) {
        toast.success(res.message);
        formRef.current?.reset();
        setJustification("");
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("Error validando el log auditado.");
    }
  };

  return (
    <form ref={formRef} action={handleAction} className="mt-6 flex flex-col gap-2 relative z-[101]">
      <input type="hidden" name="storeId" value={storeId} />

      <label
        htmlFor="justification"
        className="text-xs font-black tracking-widest uppercase text-gray-500"
      >
        Descargo de Responsabilidad Operativa (Mín. 20 Caracteres)
      </label>

      <textarea
        name="justification"
        id="justification"
        rows={3}
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
        placeholder="Ej: Hubo un corte de cadena de frío y 15kg de carne debieron descartarse según normativa bromatológica..."
        required
        className="w-full p-4 bg-[var(--bg-sunken)] border border-[var(--border-default)] rounded-xl resize-none
                   focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-transparent text-sm text-gray-900"
      />
      <div className="flex justify-between items-center text-xs mt-1">
        <span className={isValid ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
          {justification.length} / 20 Caracteres mínimos
        </span>
      </div>

      <SubmitButton isValid={isValid} />
    </form>
  );
}
