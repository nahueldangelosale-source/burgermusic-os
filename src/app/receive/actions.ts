"use server";

import { parseInvoice } from "@/lib/ai/invoice-parser";
import { db } from "@/db";
import { suppliers, receptions, products, priceHistory } from "@/db/schema";
import { sql, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { z } from "zod";
import { recordTransaction } from "@/core/stock-engine";

export async function processInvoice(formData: FormData) {
    try {
        const file = formData.get("file") as File;

        if (!file) {
            return { success: false, error: "No file uploaded" };
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`Processing file: ${file.name} (${file.type})`);

        // Call AI Parser
        const aiResult = await parseInvoice(buffer, file.type);

        if (!aiResult.success) {
            return { success: false, error: aiResult.error };
        }

        // --- PROCESS AI RESULTS ---
        interface AIInvoiceData {
            supplier_name: string;
            invoice_number: string;
            total_amount: number;
            items: {
                description: string;
                quantity: number;
                unit_price: number;
                total_price: number;
                unit?: string;
            }[];
        }

        const rawData = aiResult.data as AIInvoiceData;

        // 1. FUZZY MATCH SUPPLIER
        const allSuppliers = await db.select().from(suppliers);
        let matchedSupplierId: string | null = null;
        let matchedSupplierName = rawData.supplier_name || "Unknown Supplier";

        if (allSuppliers.length > 0 && rawData.supplier_name) {
            const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
            const target = normalize(rawData.supplier_name);
            const match = allSuppliers.find(s => normalize(s.name).includes(target) || target.includes(normalize(s.name)));
            if (match) {
                matchedSupplierId = match.id;
                matchedSupplierName = match.name;
            }
        }

        // 2. FUZZY MATCH PRODUCTS FOR EACH ITEM
        const allProducts = await db.select({ id: products.id, name: products.name, unit: products.unit }).from(products);

        const enrichedItems = rawData.items.map((item: any) => {
            let matchedProductSku = null;
            let systemUnit = null;

            if (allProducts.length > 0) {
                const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
                const itemDesc = normalize(item.description);

                // Simple match: description contains product name OR product name contains description (risky but okay for MVP)
                const match = allProducts.find(p => {
                    const pName = normalize(p.name);
                    return itemDesc.includes(pName) || pName.includes(itemDesc);
                });

                if (match) {
                    matchedProductSku = match.id;
                    systemUnit = match.unit;
                }
            }

            return {
                ...item,
                product_sku: matchedProductSku,
                system_unit: systemUnit,
                conversion_factor: 1, // Default, UI will allow edit
            };
        });

        const enrichedData = {
            ...rawData,
            supplier_id: matchedSupplierId,
            supplier_match_confidence: matchedSupplierId ? "HIGH" : "NONE",
            original_supplier_name: rawData.supplier_name,
            items: enrichedItems
        };

        return { success: true, data: enrichedData };

    } catch (error) {
        console.error("Process Invoice Error:", error);
        return { success: false, error: "Server processing failed" };
    }
}



const InvoiceItemSchema = z.object({
    description: z.string(),
    quantity: z.number().or(z.string().transform(v => parseFloat(v))),
    unit_price: z.number(),
    total_price: z.number(),
    unit: z.string().optional(),
    product_sku: z.string().nullable().optional(),
    conversion_factor: z.number().or(z.string().transform(v => parseFloat(v))).default(1),
});

const InvoiceSchema = z.object({
    supplier_name: z.string(),
    invoice_number: z.string(),
    total_amount: z.number(),
    items: z.array(InvoiceItemSchema),
});

export async function confirmInvoice(data: any) {
    const session = await getSession();
    if (!session) return { success: false, error: "Unauthorized" };

    // 1. Zod Validation (Strict Input Check)
    const validation = InvoiceSchema.safeParse(data);
    if (!validation.success) {
        console.error("Validation Error:", validation.error);
        return { success: false, error: "Invalid invoice data format" };
    }

    const invoice = validation.data;

    try {
        await db.transaction(async (tx) => {
            // 2. Save Reception Record
            const receptionId = `REC-${Date.now()}`;

            // Note: Schema defines fileUrl and other fields. Using explicit object to ensure type match.
            await tx.insert(receptions).values({
                id: receptionId,
                supplier: invoice.supplier_name,
                invoiceNumber: invoice.invoice_number,
                totalAmount: Math.round(invoice.total_amount * 100), // Store in cents
                fileUrl: null,
                mimeType: "application/octet-stream",
                status: "CONFIRMED",
                rawData: JSON.stringify(invoice),
                createdBy: session.user.id
            } as any);

            // 3. Iterate Items & Update Inventory/Cost
            for (const item of invoice.items) {
                if (item.product_sku) {
                    const productSku = item.product_sku;
                    const quantityReceived = item.quantity || 0;
                    const conversionFactor = item.conversion_factor || 1;
                    const finalQuantity = quantityReceived * conversionFactor;

                    // B. Calculate system unit cost
                    const invoiceUnitCost = item.unit_price;
                    const systemUnitCostCents = Math.round((invoiceUnitCost / conversionFactor) * 100);

                    // A. Record RECEIPT transaction in Ledger
                    await recordTransaction(tx, {
                        type: "RECEIPT",
                        productSku: productSku,
                        quantity: finalQuantity,
                        costCentsAtTime: systemUnitCostCents,
                        referenceId: receptionId,
                        notes: `Factura ${invoice.invoice_number}`,
                        createdBy: session.user.id,
                    });

                    // C. Fetch current cost to check for change
                    const [currentProduct] = await tx
                        .select({ costCents: products.costCents })
                        .from(products)
                        .where(eq(products.id, productSku));

                    if (currentProduct && currentProduct.costCents !== systemUnitCostCents) {
                        // Log Price History
                        await tx.insert(priceHistory).values({
                            productSku: productSku,
                            oldCost: currentProduct?.costCents || 0,
                            newCost: systemUnitCostCents,
                            changedBy: session.user.id,
                            changeReason: `Factura ${invoice.invoice_number}`,
                        } as any);

                        // Update Product Cost
                        await tx.update(products)
                            .set({ costCents: systemUnitCostCents } as any)
                            .where(eq(products.id, productSku));
                    }
                }
            }
        });

        return { success: true };
    } catch (e) {
        console.error("Confirmation Error:", e);
        return { success: false, error: "Database error" };
    }
}
