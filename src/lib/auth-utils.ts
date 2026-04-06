import { getSession } from "@/lib/auth";

/**
 * requireManagerSession()
 * ───────────────────────
 * Zero-Trust Session Extraction Utility.
 * Replaces the boilerplate pattern of:
 *   const session = await getSession();
 *   const storeId = session?.user?.storeId;
 *   if (!storeId) throw new Error("UNAUTHORIZED_ACCESS");
 *
 * Returns a strongly-typed context or throws Fail-Closed.
 */

export interface SessionContext {
  userId: string;
  storeId: string;
  role: string;
  userName: string;
}

export async function requireManagerSession(): Promise<SessionContext> {
  const session = await getSession();

  if (!session?.user?.id || !session.user.storeId) {
    throw new Error("UNAUTHORIZED_ACCESS: Sesión inválida o storeId ausente. Fail-Closed.");
  }

  const user = session.user;
  const role = (user.role as string) || "UNKNOWN";

  // Zero-Trust: Only valid operational roles may perform mutations
  const allowedRoles = ["OWNER_GLOBAL", "MANAGER_LOCAL", "STAFF", "ADMIN"];
  if (!allowedRoles.includes(role)) {
    throw new Error(`UNAUTHORIZED_ACCESS: Rol '${role}' no tiene permisos de mutación.`);
  }

  return {
    userId: user.id as string,
    storeId: user.storeId as string,
    role,
    userName: (user.name as string) || "SYSTEM",
  };
}

/**
 * requireReadSession()
 * ────────────────────
 * Lighter gate for read-only operations.
 * Only requires a valid session with storeId, doesn't enforce role.
 */
export async function requireReadSession(): Promise<{ userId: string; storeId: string }> {
  const session = await getSession();

  if (!session?.user?.storeId) {
    throw new Error("UNAUTHORIZED_ACCESS: Store ID missing. Fail-Closed.");
  }

  return {
    userId: (session.user.id as string) || "ANON",
    storeId: session.user.storeId as string,
  };
}
