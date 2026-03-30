import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { ingestHistoricalSales } from "../actions/bulk-sales-ingestion";
import { PivotParser } from "../lib/utils/csv-mapper";

// Códigos ANSI para colorear el CLI del SRE
const COLORS = {
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  CYAN: "\x1b[36m",
  MAGENTA: "\x1b[35m",
  RESET: "\x1b[0m",
  BOLD: "\x1b[1m",
};

async function detonateLive() {
  console.log(
    `\n${COLORS.MAGENTA}${COLORS.BOLD}⚡ INICIANDO PROTOCOLO DE DETONACIÓN (FASE 28) ⚡${COLORS.RESET}\n`,
  );

  const filePath = path.join(process.cwd(), "ventas_2026_crudo.csv");

  if (!fs.existsSync(filePath)) {
    console.error(
      `${COLORS.RED}[ABORTADO] Archivo ventas_2026_crudo.csv no encontrado en la raíz.${COLORS.RESET}`,
    );
    printCtoInstructions();
    process.exit(1);
  }

  console.log(`${COLORS.CYAN}1. Leyendo matriz de disco local...${COLORS.RESET}`);
  console.time("Detonación");

  // Escudo de Codificación (Zero-Trust)
  const rawText = fs.readFileSync(filePath, "utf8");

  // Fricción Positiva: Validación Regex de Carácter de Reemplazo (Corrupción ANSI/ISO-8859)
  if (/\uFFFD/.test(rawText)) {
    console.error(
      `\n${COLORS.RED}${COLORS.BOLD}CRITICAL ERROR (Zero-Trust): El archivo CSV contiene caracteres corruptos y no es un UTF-8 válido. Abortando inyección para proteger el Ledger de Turso DB.${COLORS.RESET}\n`,
    );
    process.exit(1);
  }
  console.log(`${COLORS.GREEN}   ✔ Firma UTF-8 Validada Satisfactoriamente.${COLORS.RESET}`);

  // Parseando y Mapeando en el Edge O(N)
  console.log(`${COLORS.CYAN}2. Tokenizando estructura dinámica con Papaparse...${COLORS.RESET}`);
  const parsedCsv = Papa.parse(rawText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().replace(/\s+/g, "_").toLowerCase(),
  });

  if (parsedCsv.errors.length > 0) {
    console.error(
      `${COLORS.RED}Advertencias de parseo detectadas:`,
      parsedCsv.errors.slice(0, 3),
      `${COLORS.RESET}`,
    );
    // No abortamos por simples warnings de filas vacías
  }

  const rawRows = parsedCsv.data as any[];
  console.log(`${COLORS.GREEN}   ✔ Estructura parseada: ${rawRows.length} filas.${COLORS.RESET}`);
  if (rawRows.length > 0) {
    console.log(`${COLORS.YELLOW}   🕵️ Fila de muestra parseada:`, rawRows[0], `${COLORS.RESET}`);
  }

  console.log(`${COLORS.CYAN}3. Iniciando PivotParser Stateful Transformer...${COLORS.RESET}`);
  const parser = new PivotParser();
  const cleanPayload = parser.parse(rawRows);
  console.log(
    `${COLORS.GREEN}   ✔ Payload Canónico generado con ${cleanPayload.length} transacciones compactadas.${COLORS.RESET}`,
  );

  console.log(
    `${COLORS.CYAN}4. Inyectando Lotes Atómicos en Turso DB (Bulk Sales Ingestion)...${COLORS.RESET}`,
  );
  try {
    const result = await ingestHistoricalSales(cleanPayload);

    console.timeEnd("Detonación");
    console.log(
      `\n${COLORS.GREEN}${COLORS.BOLD}🎉 INYECCIÓN EXITOSA: ${result.totalProcessed} transacciones sincronizadas con el Ledger.${COLORS.RESET}`,
    );
    if (result.failedBatches.length > 0) {
      console.log(
        `${COLORS.YELLOW}   ⚠ Lotes fallidos: ${result.failedBatches.join(", ")}${COLORS.RESET}`,
      );
    }
  } catch (error) {
    console.error(
      `\n${COLORS.RED}${COLORS.BOLD}FALLO CATASTRÓFICO DURANTE LA INYECCIÓN SQL:${COLORS.RESET}`,
      error,
    );
    process.exit(1);
  }

  printCtoInstructions();
  process.exit(0);
}

function printCtoInstructions() {
  console.log(
    `\n${COLORS.YELLOW}${COLORS.BOLD}--- INSTRUCCIONES DE OBSERVABILIDAD PARA EL CTO ---${COLORS.RESET}`,
  );
  console.log(
    `${COLORS.CYAN}Paso 1:${COLORS.RESET} Colocar el archivo CSV ${COLORS.BOLD}ventas_2026_crudo.csv${COLORS.RESET} en la raíz del proyecto (Si no lo hiciste aún).`,
  );
  console.log(
    `${COLORS.CYAN}Paso 2:${COLORS.RESET} Ejecutar este mismo script: ${COLORS.GREEN}npx tsx --env-file=.env src/scripts/fire-historical-sales.ts${COLORS.RESET}`,
  );
  console.log(
    `${COLORS.CYAN}Paso 3:${COLORS.RESET} Abrir ${COLORS.BOLD}http://localhost:3000/dashboard${COLORS.RESET} para ver el Mando Global renderizar los ingresos.`,
  );
  console.log(
    `${COLORS.CYAN}Paso 4:${COLORS.RESET} Ingresar 2 proveedores secundarios en el formulario ${COLORS.BOLD}SupplierArbitrageForm${COLORS.RESET} para ver el cruce analítico en vivo en la tarjeta de Oportunidades.`,
  );
  console.log(
    `${COLORS.YELLOW}---------------------------------------------------${COLORS.RESET}\n`,
  );
}

detonateLive();
