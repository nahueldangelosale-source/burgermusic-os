import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Función Edge-First para Explosión de Ventas Diarias
 * Pasa de un array plano de ventas (JSON) a sus requerimientos exactos atómicos.
 */
export async function explodeDailySales(salesJsonArray: string) {
  const result = await db.all(sql`
    WITH RECURSIVE sale_items AS (
      -- Desempaquetar el JSON de ventas: [{ "productId": "P1", "qtySold": 100 }]
      SELECT 
        json_extract(value, '$.productId') as product_id,
        json_extract(value, '$.qtySold') as qty_sold
      FROM json_each(${salesJsonArray})
    ),
    bom_explosion AS (
      -- ANCHOR: Nivel 0 (Ventas directas cruzadas con la primera capa del BOM)
      SELECT 
        b.child_id as component_id,
        (b.quantity * b.unit_multiplier * CAST(s.qty_sold AS REAL)) as required_qty,
        1 as depth
      FROM bill_of_materials b
      JOIN sale_items s ON b.parent_id = s.product_id
      
      UNION ALL
      
      -- RECURSION: Sub-recetas (Desgranar hasta la materia prima base)
      SELECT 
        b.child_id as component_id,
        (b.quantity * b.unit_multiplier * e.required_qty) as required_qty,
        e.depth + 1
      FROM bill_of_materials b
      JOIN bom_explosion e ON b.parent_id = e.component_id
      WHERE e.depth < 10 -- LIMITADOR ZERO-TRUST: Previene bucles infinitos
    )
    -- AGREGACIÓN FINAL O(1)
    SELECT 
      component_id as rawMaterialId, 
      SUM(required_qty) as totalConsumedQty 
    FROM bom_explosion 
    GROUP BY component_id;
  `);

  return result;
}
