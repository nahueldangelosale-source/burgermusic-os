import { getLabData } from "./actions";
import RecipeBuilder from "@/components/RecipeBuilder";

export default async function LabPage() {
    const { products, ingredients, recipes } = await getLabData();

    return (
        <div className="h-screen bg-canvas-50 p-4 sm:p-6 overflow-hidden flex flex-col">
            <header className="mb-6 flex-none">
                <h1 className="text-2xl font-black tracking-tight text-ink-900 uppercase flex items-center gap-2">
                    <span className="text-brand-500">///</span> Laboratorio de Recetas
                </h1>
            </header>

            <div className="flex-1 min-h-0">
                <RecipeBuilder
                    products={products}
                    ingredients={ingredients}
                    existingRecipes={recipes}
                />
            </div>
        </div>
    );
}
