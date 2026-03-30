const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/actions/excel-ingestion.ts');
let content = fs.readFileSync(file, 'utf8');

const target = `            // Fallback general para atrapar el $ remaining a la categoría "Classic" para no perder ingresos en el dashboard
            else realSku = "PRD_CLASSIC";`;

const replacement = `            else {
                // AUTO-ANEXADOR: Si no existe, crearlo dinámicamente en el catálogo. No más orphans.
                const cleanId = "PRD_AUTO_" + String(normDesc).toUpperCase().replace(/[^A-Z0-9]/g, "_").slice(0, 25);
                
                if (!createdSkus.has(cleanId) && !productDictionary.has(normDesc)) {
                    autoLinkProducts.push({
                        id: cleanId,
                        name: String(descripcion).trim().substring(0, 50),
                        category: "BURGER",
                        isSaleable: true,
                        base_price_cents: netPriceCents > 0 ? Math.round(netPriceCents / Math.max(1, Number(cantidad))) : 0,
                        sellingPrice: netPriceCents > 0 ? Math.round(netPriceCents / Math.max(1, Number(cantidad))) : 0,
                        description: "Auto-Anexado por Excel Ingestion Vault"
                    });
                    createdSkus.add(cleanId);
                    productDictionary.set(normDesc, cleanId);
                }
                realSku = productDictionary.get(normDesc) || cleanId;
            }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    console.log("Patched successfully!");
} else {
    console.log("TARGET NOT FOUND. Trying with regex to ignore whitespace variations.");
    const regex = /\/\/\s*Fallback general para atrapar.*?\n\s*else realSku = "PRD_CLASSIC";/s;
    if (regex.test(content)) {
        content = content.replace(regex, replacement);
        fs.writeFileSync(file, content);
        console.log("Patched via regex successfully!");
    } else {
        console.log("FATAL: Target absolutely not found.");
    }
}
