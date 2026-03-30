import { real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const uomConversions = sqliteTable(
  "uom_conversions",
  {
    id: text("id").primaryKey(),
    fromUnit: text("from_unit").notNull(), // Ej: 'BOX_20KG', 'SACK_50L'
    toBaseUnit: text("to_base_unit").notNull(), // Ej: 'GR', 'ML'
    multiplier: real("multiplier").notNull(), // Ej: 20000.0, 50000.0
  },
  (table) => {
    return {
      uniqueTranslation: uniqueIndex("unique_translation_idx").on(table.fromUnit, table.toBaseUnit),
    };
  },
);
