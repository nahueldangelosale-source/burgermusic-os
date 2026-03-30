// src/integrations/google-sheets/client.ts
// Cliente autenticado para la API de Google Sheets.
// Usa Service Account con credenciales JSON en Base64.

import { google } from "googleapis";

/**
 * Decodifica las credenciales del Service Account desde Base64
 * y devuelve un cliente autenticado de Google Sheets.
 */
function getAuthClient() {
  const b64 = process.env.GOOGLE_SHEETS_CREDENTIALS_B64;
  if (!b64) {
    throw new Error(
      "GOOGLE_SHEETS_CREDENTIALS_B64 is not defined in environment variables. " +
        "Encode your GCP Service Account JSON as base64 and set it.",
    );
  }

  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return auth;
}

/**
 * Lee un rango de datos de una hoja de Google Sheets.
 * @param spreadsheetId - ID del spreadsheet (de la URL)
 * @param range - Rango A1 notation. Ej: "Sheet1!A:E" o "Ventas!A2:E"
 * @returns Matriz de strings (filas × columnas)
 */
export async function readSheetData(
  spreadsheetId: string,
  range = "Sheet1!A:E",
): Promise<string[][]> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log("Google Sheets: La hoja está vacía o no tiene datos en el rango.");
      return [];
    }

    return rows as string[][];
  } catch (error: any) {
    const status = error?.code || error?.response?.status;
    if (status === 403) {
      throw new Error(
        `Google Sheets API: Acceso denegado (403). ¿Compartiste el Sheet con el email del Service Account?`,
      );
    }
    if (status === 404) {
      throw new Error(
        `Google Sheets API: Spreadsheet no encontrado (404). Verificá GOOGLE_SHEETS_SPREADSHEET_ID.`,
      );
    }
    throw new Error(`Google Sheets API Error: ${error.message}`);
  }
}

/**
 * Lista todas las pestañas (tabs) de un spreadsheet.
 * @returns Array de nombres de pestañas, ej: ["MARZO", "FEBRERO", "ENERO"]
 */
export async function listSheetTabs(spreadsheetId: string): Promise<string[]> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.title",
    });

    const sheetList = response.data.sheets;
    if (!sheetList || sheetList.length === 0) {
      return [];
    }

    return sheetList.map((s) => s.properties?.title).filter((t): t is string => !!t);
  } catch (error: any) {
    throw new Error(`Google Sheets API Error (listTabs): ${error.message}`);
  }
}
