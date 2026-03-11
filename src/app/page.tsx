import Link from "next/link";
import {
    Bot,
    ArrowRight,
    Database,
    TrendingUp,
    AlertTriangle,
    Zap,
    MessageSquare
} from "lucide-react";

export default function Home() {
    return (
        <div className="space-y-8">

            {/* HEADER DE BIENVENIDA */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Hola, BurgerMusic</h1>
                    <p className="text-slate-500 mt-2 text-lg">Tus agentes están activos y monitoreando el margen.</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Sistemas Operativos
                </div>
            </div>

            {/* BENTO GRID DE MÓDULOS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* CARD 1: AGENTE TRADUCTOR (Grande) */}
                <Link href="/ingest" className="md:col-span-2 group relative overflow-hidden bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all hover:border-blue-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Bot size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                            <MessageSquare size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Agente Traductor</h3>
                        <p className="text-slate-500 mt-2 max-w-md">
                            Procesa mensajes de WhatsApp, audios y texto libre para digitalizar el stock físico en segundos.
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-4 transition-all">
                            Ingresar reporte de cocina <ArrowRight size={18} />
                        </div>
                    </div>
                </Link>

                {/* CARD 2: ESTADO FINANCIERO */}
                <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                    <div>
                        <h3 className="text-slate-300 font-medium">Margen Protegido</h3>
                        <div className="text-4xl font-bold mt-2 tracking-tight">$0.00</div>
                        <p className="text-slate-400 text-sm mt-1">Acumulado Mes Actual</p>
                    </div>
                    <div className="mt-8">
                        <div className="flex items-center gap-2 text-sm text-slate-300 bg-slate-800/50 p-2 rounded-lg">
                            <Zap size={14} className="text-yellow-400" />
                            <span>3 Agentes activos</span>
                        </div>
                    </div>
                </div>

                {/* CARD 3: IMPORTAR VENTAS */}
                <Link href="/sales" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 transition-all group">
                    <div className="flex justify-between items-start">
                        <div className="h-10 w-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
                            <Database size={20} />
                        </div>
                        <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded">POS Link</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-4">Cargar Ventas</h3>
                    <p className="text-slate-500 text-sm mt-1">Sincroniza el CSV diario para calcular teóricos.</p>
                </Link>

                {/* CARD 4: AUDITORÍA (Dashboard) */}
                <Link href="/dashboard" className="md:col-span-2 bg-gradient-to-br from-white to-slate-50 p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 transition-all group">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Panel de Auditoría</h3>
                            <p className="text-slate-500 text-sm">Detecta varianzas, robos hormiga y errores de receta.</p>
                        </div>
                        <div className="ml-auto bg-white border border-slate-200 rounded-full p-2 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            <ArrowRight size={20} />
                        </div>
                    </div>
                </Link>

            </div>

            {/* FOOTER DE ESTADO */}
            <div className="border-t border-slate-200 pt-8 mt-12 flex justify-between items-center text-xs text-slate-400">
                <div>
                    ÉGIDA OS v1.0.0 • Powered by Antigravity
                </div>
                <div className="flex gap-4">
                    <span>Server: Online</span>
                    <span>Database: Turso (Edge)</span>
                    <span>AI: Gemini 1.5 Flash</span>
                </div>
            </div>
        </div>
    );
}
