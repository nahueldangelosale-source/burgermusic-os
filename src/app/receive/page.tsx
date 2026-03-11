import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UploadZone } from "./upload-zone"; // Client Component

export default async function ReceiverPage() {
    const session = await getSession();

    // Strictly enforce Receiver or Manager
    if (!session || (session.user.role !== "RECEIVER" && session.user.role !== "MANAGER")) {
        redirect("/login");
    }

    return (
        <div className="max-w-xl mx-auto space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-black tracking-tight text-ink-900 uppercase">
                    Recepción de Mercadería
                </h1>
                <p className="text-slate-500 font-medium">
                    Sube fotos de facturas o archivos PDF para procesar el ingreso de stock.
                </p>
            </div>

            <UploadZone />
        </div>
    );
}
