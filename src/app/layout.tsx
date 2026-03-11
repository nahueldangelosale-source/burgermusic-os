import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

import { getSession } from "@/lib/auth";
import {
  LayoutDashboard,
  ShoppingCart,
  MessageSquare,
  ChefHat,
  Activity,
  LogOut,
  User
} from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton"; // We need to create this client component



export const metadata: Metadata = {
  title: "BurgerMusic OS",
  description: "Sistema Operativo Gastronómico",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const role = session?.user?.role;

  return (
    <html lang="es">
      <body className={`antialiased min-h-screen flex flex-col bg-canvas-50 text-ink-900 font-sans`}>

        {/* TOPBAR PROFESIONAL */}
        <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">

              {/* LOGO & BRAND */}
              <div className="flex items-center gap-3">
                <div className="bg-slate-900 text-white p-1.5 rounded-lg">
                  <Activity size={20} />
                </div>
                <span className="font-bold text-lg tracking-tight text-slate-900">
                  BURGERMUSIC <span className="text-brand-500 font-normal">OS</span>
                </span>
              </div>

              {/* MENU DE MÓDULOS - VISIBLE ONLY IF LOGGED IN */}
              {session && (
                <div className="hidden md:flex space-x-1 items-center">
                  {/* MANAGER LINKS */}
                  {role === 'MANAGER' && (
                    <>
                      <NavLink href="/dashboard" icon={<LayoutDashboard size={18} />} label="Centro de Mando" />
                      <div className="h-6 w-px bg-slate-200 my-auto mx-2" />
                    </>
                  )}

                  {/* KITCHEN LINKS */}
                  {(role === 'MANAGER' || role === 'KITCHEN') && (
                    <NavLink href="/ingest" icon={<MessageSquare size={18} />} label="Cocina" />
                  )}

                  {/* SHARED/OTHER LINKS */}
                  {role === 'MANAGER' && (
                    <>
                      <NavLink href="/sales" icon={<ShoppingCart size={18} />} label="Ventas" />
                      <NavLink href="/lab" icon={<Activity size={18} />} label="Laboratorio" />
                      {/* Costos is sub-route of dashboard */}
                    </>
                  )}
                </div>
              )}

              {/* USER PROFILE / AUTH ACTIONS */}
              <div className="flex items-center gap-4">
                {!session ? (
                  <Link href="/login" className="text-sm font-bold text-slate-600 hover:text-brand-600 transition-colors">
                    Iniciar Sesión
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end mr-2">
                      <span className="text-xs font-bold text-ink-900 uppercase tracking-wider">{session.user.name}</span>
                      <span className="text-[10px] font-mono text-brand-600 bg-brand-50 px-1.5 rounded">{session.user.role}</span>
                    </div>
                    <div className="h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
                      <User size={16} />
                    </div>
                    <LogoutButton />
                  </div>
                )}
              </div>

            </div>
          </div>
        </nav>

        {/* AREA DE CONTENIDO PRINCIPAL */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
          {children}
        </main>

      </body>
    </html>
  );
}

// Componente de Link con estilos interactivos
function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center px-4 py-2 text-sm font-medium text-slate-500 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-all group"
    >
      <span className="group-hover:text-brand-600 transition-colors mr-2">{icon}</span>
      {label}
    </Link>
  );
}
