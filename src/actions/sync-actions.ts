"use server";

import { syncCashClosures } from "@/integrations/google-sheets/sales-sync";
import { authenticatedAction } from "@/lib/auth-action";

export const syncSalesAction = authenticatedAction(async (_, { user }) => {
  console.log(`[SYNC] Iniciando sincronización por usuario: ${user.name} (${user.role})`);
  
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
});
