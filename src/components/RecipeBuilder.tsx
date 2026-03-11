"use client";

import React, { useState, useMemo } from "react";
import { StackCard, QuantityStepper, KitchenButton, GlassCard } from "@/components/ui/AntigravityAtoms";
import { saveRecipe } from "@/app/lab/actions";
import { Search, Save, Package, ChefHat, ArrowRight } from "lucide-react";

interface Product {
    id: string;
    name: string;
    unit: string;
    costCents: number | null;
}

interface Ingredient {
    id: string;
    name: string;
    unit: string;
    costCents: number | null;
}

interface RecipeBuilderProps {
    products: Product[];
    ingredients: Ingredient[];
    existingRecipes: Record<string, { ingredientSku: string; quantity: number }[]>;
}

export default function RecipeBuilder({ products, ingredients, existingRecipes }: RecipeBuilderProps) {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [currentRecipe, setCurrentRecipe] = useState<{ id: string; quantity: number }[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Initial Load of Recipe when product is selected
    React.useEffect(() => {
        if (selectedProduct && existingRecipes[selectedProduct.id]) {
            // Deduplicate ingredients (Last one wins or sum?) - Let's just take the first occurrence or sum quantities?
            // Simple dedupe: Map by ID
            const uniqueMap = new Map<string, number>();
            existingRecipes[selectedProduct.id].forEach(r => {
                uniqueMap.set(r.ingredientSku, r.quantity); // Overwrites duplicates, effectively deduping
            });

            const dedupedListeners = Array.from(uniqueMap.entries()).map(([id, quantity]) => ({ id, quantity }));
            setCurrentRecipe(dedupedListeners);
        } else {
            setCurrentRecipe([]);
        }
    }, [selectedProduct, existingRecipes]);

    // Handle Adding/Updating Ingredient
    const updateIngredient = (ingredientId: string, quantity: number) => {
        if (quantity <= 0) {
            setCurrentRecipe(prev => prev.filter(i => i.id !== ingredientId));
            return;
        }

        setCurrentRecipe(prev => {
            const exists = prev.find(i => i.id === ingredientId);
            if (exists) {
                return prev.map(i => i.id === ingredientId ? { ...i, quantity } : i);
            }
            return [...prev, { id: ingredientId, quantity }];
        });
    };

    const handleSave = async () => {
        if (!selectedProduct) return;
        setIsSaving(true);
        await saveRecipe(selectedProduct.id, currentRecipe.map(i => ({ ingredientSku: i.id, quantity: i.quantity })));
        setIsSaving(false);
        alert("¡Receta Guardada!"); // TODO: Replace with better toast
    };

    // Derived State
    const totalCost = currentRecipe.reduce((acc, item) => {
        const ing = ingredients.find(i => i.id === item.id);
        return acc + (item.quantity * (ing?.costCents || 0));
    }, 0) / 100;

    const filteredIngredients = useMemo(() => {
        if (!searchQuery) return ingredients.slice(0, 12); // Show top 12 initially
        return ingredients.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [ingredients, searchQuery]);

    const formattedCurrency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-140px)]">

            {/* LEFT: THE MENU (Product Selector) */}
            <div className="lg:col-span-4 flex flex-col gap-4 h-full overflow-hidden">
                <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-lg">
                    <Search size={20} className="text-slate-400" />
                    <input
                        className="bg-transparent w-full outline-none text-sm font-medium"
                        placeholder="Buscar producto a diseñar..."
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                    {products.map(p => (
                        <div
                            key={p.id}
                            onClick={() => setSelectedProduct(p)}
                            className={`
                                p-4 rounded-xl cursor-pointer transition-all border-l-4
                                ${selectedProduct?.id === p.id
                                    ? "bg-white border-l-brand-500 shadow-md transform scale-[1.02]"
                                    : "bg-slate-50 border-l-transparent hover:bg-white hover:shadow-sm"
                                }
                            `}
                        >
                            <h3 className="font-bold text-ink-900">{p.name}</h3>
                            <p className="text-xs text-ink-400 font-mono mt-1">{p.id}</p>
                            {existingRecipes[p.id] ? (
                                <div className="mt-2 flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded w-fit">
                                    <ChefHat size={12} /> {existingRecipes[p.id].length} ingr.
                                </div>
                            ) : (
                                <div className="mt-2 text-xs text-slate-400 italic">Sin receta</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: THE ASSEMBLY TABLE */}
            <div className="lg:col-span-8 flex flex-col h-full">
                {selectedProduct ? (
                    <>
                        {/* Header of Assembly */}
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Diseñando</div>
                                <h2 className="text-3xl font-black text-ink-900">{selectedProduct.name}</h2>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Costo Teórico</div>
                                <div className="text-3xl font-black text-ink-900 font-mono">{formattedCurrency.format(totalCost)}</div>
                            </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-hidden min-h-0">

                            {/* COLUMN 1: CURRENT STACK (What's in the burger) */}
                            <GlassCard className="flex flex-col h-full bg-slate-50/50">
                                <div className="p-4 border-b border-slate-200 bg-white/50 backdrop-blur-sm">
                                    <h4 className="font-bold text-ink-900 flex items-center gap-2">
                                        <Package size={18} /> En la Receta ({currentRecipe.length})
                                    </h4>
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                                    {currentRecipe.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-8 border-2 border-dashed border-slate-200 rounded-xl">
                                            <ChefHat size={48} className="mb-4 opacity-50" />
                                            <p className="font-medium">Arrastra o selecciona ingredientes del panel derecho</p>
                                        </div>
                                    ) : (
                                        currentRecipe.map(item => {
                                            const ing = ingredients.find(i => i.id === item.id);
                                            if (!ing) return null;
                                            return (
                                                <StackCard key={item.id} className="bg-white border-brand-200 shadow-sm" active>
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <div className="font-bold text-ink-900">{ing.name}</div>
                                                            <div className="text-xs text-slate-400 font-mono">{formattedCurrency.format((ing.costCents || 0) / 100)} / {ing.unit}</div>
                                                        </div>
                                                        <QuantityStepper
                                                            value={item.quantity}
                                                            unit={ing.unit}
                                                            onChange={(val) => updateIngredient(item.id, val)}
                                                        />
                                                    </div>
                                                </StackCard>
                                            );
                                        })
                                    )}
                                </div>
                            </GlassCard>

                            {/* COLUMN 2: INGREDIENT PALETTE */}
                            <div className="flex flex-col h-full">
                                <div className="mb-4 relative">
                                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input
                                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                                        placeholder="Buscar ingrediente (ej: Cheddar)..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
                                    {filteredIngredients.map(ing => {
                                        const isInRecipe = currentRecipe.some(i => i.id === ing.id);
                                        return (
                                            <StackCard
                                                key={ing.id}
                                                onClick={() => !isInRecipe && updateIngredient(ing.id, 1)}
                                                className={`
                                                    ${isInRecipe ? 'opacity-50 grayscale cursor-default' : 'hover:border-brand-300'}
                                                `}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <div className="font-bold text-slate-700">{ing.name}</div>
                                                        <div className="text-xs text-slate-400 font-mono">Stock: N/A</div>
                                                    </div>
                                                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                        {isInRecipe ? <ArrowRight size={14} /> : '+'}
                                                    </div>
                                                </div>
                                            </StackCard>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>

                        {/* Footer Action */}
                        <div className="mt-6 pt-4 border-t border-slate-200">
                            <KitchenButton onClick={handleSave} disabled={isSaving}>
                                {isSaving ? "Guardando..." : "Confirmar Diseño de Receta"}
                            </KitchenButton>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <Package size={48} className="text-slate-300" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-300 uppercase tracking-tight">El Laboratorio</h2>
                        <p className="text-slate-400 max-w-md mt-2">Selecciona un producto del menú lateral para comenzar a diseñar su composición y costos.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
