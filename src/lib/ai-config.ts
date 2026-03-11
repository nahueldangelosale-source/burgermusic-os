import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Inicializamos el proveedor con tu API Key del .env
const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Exportamos el modelo "Flash" para velocidad en tareas de parseo
export const parsingModel = google('gemini-1.5-flash');
