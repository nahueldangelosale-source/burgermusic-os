import { describe, expect, it, vi } from "vitest";
import { resolveRecipeFootprint } from "../lib/recipe-parser";

// Mock the DB since resolveRecipeFootprint queries it
vi.mock("@/db", () => ({
  db: {
    transaction: async (cb: any) =>
      cb({
        select: () => ({
          from: () => ({
            where: (condition: any) => {
              // Mock DB responses based on SKU
              // In real Drizzle queries `condition` is an EQ object, we'll mock conservatively
              return Promise.resolve([
                { ingredientSku: "MOCK_DOUGH", quantity: 300 },
                { ingredientSku: "MOCK_CHEESE", quantity: 150 },
              ]);
            },
          }),
        }),
      }),
  },
}));

describe("Recipe Engine (BOM) Logic - DB Driven", () => {
  it("should parse a pizza recipe dynamically from DB", async () => {
    // We mock a transaction object
    const mockTx: any = {
      select: () => ({
        from: () => ({
          where: () =>
            Promise.resolve([
              { ingredientSku: "PIZZA_DOUGH", quantity: 300 },
              { ingredientSku: "MOZZARELLA", quantity: 150 },
            ]),
        }),
      }),
    };

    const ingredients = await resolveRecipeFootprint(mockTx, "Pizza Muzzarella L", 1);

    expect(ingredients).toContainEqual({ sku: "PIZZA_DOUGH", quantity: 300 });
    expect(ingredients).toContainEqual({ sku: "MOZZARELLA", quantity: 150 });
  });

  it("should handle multiplier logic natively", async () => {
    const mockTx: any = {
      select: () => ({
        from: () => ({
          where: () =>
            Promise.resolve([
              { ingredientSku: "BURGER_PATTY", quantity: 1 },
              { ingredientSku: "CHEDDAR", quantity: 2 },
            ]),
        }),
      }),
    };

    // If someone ordered 3x Double Burgers, multiplierQty = 3
    const ingredients = await resolveRecipeFootprint(mockTx, "Doble Z", 3);

    expect(ingredients).toContainEqual({ sku: "BURGER_PATTY", quantity: 3 });
    expect(ingredients).toContainEqual({ sku: "CHEDDAR", quantity: 6 });
  });

  it("should fallback to raw SKU if recipe is not found", async () => {
    const mockTx: any = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([]), // DB Returns empty hook
        }),
      }),
    };

    const ingredients = await resolveRecipeFootprint(mockTx, "COCA_COLA", 2);

    expect(ingredients).toContainEqual({ sku: "COCA_COLA", quantity: 2 });
  });
});
