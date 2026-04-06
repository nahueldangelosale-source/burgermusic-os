import { getSession } from "@/lib/auth";

/**
 * requireManagerSession
 * ─────────────────────────────────────────────────────────────────────────────
 * Zero-Trust Session Extraction Utility.
 * Validates the JWT session via getSession() and extracts the tenant context.
 * Implements a Fail-Closed shield against orphaned or null sessions.
 */
export async function requireManagerSession() {
  try {
    const session = await getSession();
    
    if (!session?.user) {
      return { success: false, error: "AUTH_MISSING: No hay sesión activa." };
    }

    const user = session.user;

    // ESCUDO ANTI-ZOMBI (Fail-Closed estricto)
    if (!user.storeId) {
      return { success: false, error: "AUTH_ORPHANED: Sesión sin storeId detectada." };
    }

    return { success: true, data: user };
  } catch (error: any) {
    console.error("[AUTH_ACTION_ERROR]:", error.message || error);
    return { success: false, error: "Fallo catastrófico en la validación Zero-Trust." };
  }
}
