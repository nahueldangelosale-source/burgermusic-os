"use server";

import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateProductFinancials(
    productSku: string,
    sellingPrice: number,
    targetMargin: number
) {
    try {
        await db.update(products)
            .set({
                sellingPrice, // In cents
                targetMargin,
                isSaleable: true // Implicitly mark as saleable if we are setting a price
            } as any)
            .where(eq(products.id, productSku));

        revalidatePath("/dashboard/menu");
        return { success: true };
    } catch (error) {
        console.error("Update Financials Error:", error);
        return { success: false, error: "Database error" };
    }
}

export async function toggleSaleable(productSku: string, isSaleable: boolean) {
    try {
        await db.update(products)
            .set({ isSaleable } as any)
            .where(eq(products.id, productSku));

        revalidatePath("/dashboard/menu");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Database error" };
    }
}
