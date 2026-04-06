import { sql, and } from "drizzle-orm";
import { db } from "@/db";

/**
 * HOF Multi-Tenant A2 (Edge Version 2026)
 * Encapsula la base de datos en un Proxy que fuerza el aislamiento por storeId.
 */
export function withTenant({ user }: { user?: { storeId?: string; role?: string } }) {
  // 1. Zero-Trust Firewall (Fail-Closed)
  if (!user || !user.storeId) {
    throw new Error("ZERO_TRUST_VIOLATION: Intento de acceso a DB sin firma criptográfica de Tenant.");
  }
  
  const { storeId, role } = user;

  // 2. Bypass para usuarios globales
  if (role === "OWNER_GLOBAL" || role === "C_LEVEL" || storeId === "global") {
    // Retorna proxy de DB sin filtros restrictivos de sucursal
    return db;
  }

  function wrap(target: any, tableInstance?: any, hasWhere = false): any {
    if (!target || typeof target !== "object") return target;
    
    // Evitar doble envoltura
    if (target._isTenantProxy) return target;

    return new Proxy(target, {
      get(t, prop, receiver) {
        if (prop === "_isTenantProxy") return true;
        
        const original = t[prop];
        if (typeof original !== "function") return original;

        // Métodos que ejecutan la query
        const isExecution = ["then", "all", "run", "get", "values"].includes(prop as string);
        if (isExecution) {
          if (!hasWhere && tableInstance) {
            const storeCol = tableInstance.storeId || tableInstance.store_id;
            if (storeCol) {
              // Usamos SQL puro en lugar de eq() para evitar problemas de referencia
              const injected = t.where(sql`${storeCol} = ${storeId}`);
              return injected[prop].bind(injected);
            }
          }
          return original.bind(t);
        }

        // Interceptores de estado
        if (prop === "where") {
          return (condition: any) => {
            const storeCol = tableInstance?.storeId || tableInstance?.store_id;
            // Usamos SQL puro para el filtro de sucursal
            const tenantFilter = storeCol ? sql`${storeCol} = ${storeId}` : null;
            const finalCondition = tenantFilter ? (condition ? and(condition, tenantFilter as any) : tenantFilter) : condition;
            return wrap(original.apply(t, [finalCondition]), tableInstance, true);
          };
        }

        if (["from", "insert", "update", "delete"].includes(prop as string)) {
          return (table: any) => {
            return wrap(original.apply(t, [table]), table, false);
          };
        }

        if (prop === "values" && tableInstance) {
          return (values: any) => {
            const storeCol = tableInstance.storeId || tableInstance.store_id;
            const storeProp = storeCol ? Object.keys(tableInstance).find(k => tableInstance[k] === storeCol) : null;
            
            const payload = Array.isArray(values) ? values : [values];
            const enriched = payload.map(v => ({
              ...v,
              ...(storeProp ? { [storeProp]: storeId } : {})
            }));
            
            return wrap(original.apply(t, [enriched]), tableInstance, hasWhere);
          };
        }

        return (...args: any[]) => {
          const result = original.apply(t, args);
          if (result && typeof result === "object" && (result.sql || result.params)) {
             return result;
          }
          if (result === t) return receiver;
          return wrap(result, tableInstance, hasWhere);
        };
      }
    });
  }

  return wrap(db);
}
