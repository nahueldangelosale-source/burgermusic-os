"use server";

import { syncCashClosures } from "@/integrations/google-sheets/sales-sync";
import { requireManagerSession } from "@/lib/auth-action";

export async function syncSalesAction() {
  const session = await requireManagerSession();
  if (!session.success || !session.data) {
    throw new Error(session.error || "ZERO_TRUST_VIOLATION: Acceso denegado.");
  }

  console.log(`[SYNC] Iniciando sincronización por usuario: ${session.data.name} (${session.data.role})`);
  
  const result = await syncCashClosures();
  
  return {
    success: true,
    totalProcessed: result.totalProcessed,
    tabs: result.tabResults.map(t => ({
      tab: t.tab,
      processed: t.processed,
      errors: t.errors
    }))
  };
}
