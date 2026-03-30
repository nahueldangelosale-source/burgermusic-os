import { z } from "zod";

export const ProductUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
});

export const ProductBatchSchema = z.array(z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  sellingPrice: z.number(),
  isSaleable: z.boolean(),
}));
