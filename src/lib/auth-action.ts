import { getSession } from "@/lib/auth";

export type ActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
};

export function authenticatedAction<T = void, R = any>(
  handler: (payload: T, context: { user: any; storeId: string }) => Promise<R>
) {
  return async (payload?: T): Promise<ActionResponse<R>> => {
    try {
      const session = await getSession();
      
      if (!session || !session.user) {
        return { success: false, error: "No autorizado. Sesión inválida o expirada.", code: 401 };
      }

      // Inyección automática del storeId de la sesión (Zero-Trust)
      const storeId = session.user.storeId;
      
      const result = await handler(payload as T, { user: session.user, storeId });
      
      return { success: true, data: result };
    } catch (error: any) {
      console.error("[AUTH_ACTION_ERROR]:", error.message);
      return { success: false, error: error.message || "Error interno del servidor", code: 500 };
    }
  };
}
