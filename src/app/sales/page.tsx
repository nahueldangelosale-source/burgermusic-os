// src/app/sales/page.tsx
"use client";

import { useState } from "react";
import { uploadSalesCSV } from "./actions"; // La acción ahora soporta Excel
import { UploadCloud, CheckCircle, AlertTriangle, FileText } from "lucide-react";

export default function SalesPage() {
    const [status, setStatus] = useState<"IDLE" | "UPLOADING" | "SUCCESS" | "ERROR">("IDLE");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus("UPLOADING");

        const formData = new FormData(e.currentTarget);

        // Invocamos tu Server Action (que ahora parsea XLSX)
        const result = await uploadSalesCSV(formData);

        if (result.success) {
            setStatus("SUCCESS");
            setMessage(result.message || "Carga exitosa.");
        } else {
            setStatus("ERROR");
            setMessage(result.message || "Error al procesar.");
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Importación de Ventas</h1>
                <p className="text-slate-500">Sube el Excel exportado del POS ("artVendidos2026.xlsx") para poblar el sistema.</p>
            </header>

            <div className="bg-white shadow rounded-lg border border-slate-200 overflow-hidden">
                <div className="p-6 space-y-6">

                    {/* Instrucciones Visuales */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <FileText className="h-5 w-5 text-blue-400" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-blue-700">
                                    El sistema leerá el archivo Excel, detectará nuevos platos y registrará las ventas.
                                </p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-blue-500 hover:bg-slate-50 transition-all cursor-pointer relative">
                            <input
                                type="file"
                                name="csvFile"
                                accept=".csv, .xlsx, .xls"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                required
                            />
                            <UploadCloud className="mx-auto h-12 w-12 text-slate-400" />
                            <p className="mt-2 text-sm font-medium text-slate-900">
                                Arrastra tu Excel (.xlsx) o CSV aquí
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={status === "UPLOADING"}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50"
                        >
                            {status === "UPLOADING" ? "Procesando Excel..." : "Subir Ventas y Generar Catálogo"}
                        </button>
                    </form>

                    {/* Feedback de Estado */}
                    {status === "SUCCESS" && (
                        <div className="rounded-md bg-green-50 p-4 mt-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <CheckCircle className="h-5 w-5 text-green-400" />
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-green-800">Carga Completada</h3>
                                    <div className="mt-2 text-sm text-green-700">
                                        <p>{message}</p>
                                        <p className="mt-2 font-bold">¡Ahora ejecuta el script de Recetas!</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {status === "ERROR" && (
                        <div className="rounded-md bg-red-50 p-4 mt-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <AlertTriangle className="h-5 w-5 text-red-400" />
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">Error en la carga</h3>
                                    <div className="mt-2 text-sm text-red-700">
                                        <p>{message}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
