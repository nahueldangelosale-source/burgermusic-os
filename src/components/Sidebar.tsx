"use client";

import { logout } from "@/lib/auth";
import {
  Activity,
  ActivitySquare,
  Banknote,
  Building2,
  ChefHat,
  ChevronDown,
  ClipboardCheck,
  Database,
  FileUp,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const MENU_GROUPS = [
  {
    name: "C-Level Operativo",
    icon: LayoutDashboard,
    items: [
      { label: "Mando Proactivo", icon: LayoutDashboard, href: "/dashboard/command-center" },
      { label: "Tesorería Global", icon: Banknote, href: "/dashboard/treasury" },
      { label: "Compras Hub", icon: Package, href: "/dashboard/purchases" },
      { label: "Capital Humano", icon: Users, href: "/dashboard/hr" },
      { label: "Ventas Vortex", icon: TrendingDown, href: "/dashboard/sales", prefetch: true },
    ],
  },
  {
    name: "Infraestructura & Supply",
    icon: Package,
    items: [
      { label: "Suministros", icon: Package, href: "/dashboard/supply" },
      { label: "KDS Trinchera", icon: ChefHat, href: "/kitchen" },
    ],
  },
  {
    name: "Finanzas Trinchera & IA",
    icon: ShieldAlert,
    items: [
      { label: "Planilla Z (Cierres)", icon: Receipt, href: "/dashboard/cashier" },
      { label: "Smart Recepción", icon: FileUp, href: "/receive" },
      { label: "Action Center (Colas)", icon: ActivitySquare, href: "/dashboard/operations/action-center" },
      { label: "Auditoría IA (Ledger)", icon: ShieldAlert, href: "/dashboard/operations/ai-audit" },
    ],
  },
];

export default function Sidebar({ user }: { user?: any }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([
    "Mando Global",
    "Operaciones",
    "Finanzas",
  ]);

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name],
    );
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-600"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Shell (Dark Premium) */}
      <aside
        className={`
                fixed top-0 left-0 h-full z-40
                w-72 border-r border-slate-800 bg-[#0B0F19] text-slate-300
                transition-transform duration-300 ease-in-out
                flex flex-col
                ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            `}
      >
        {/* 1. BRAND */}
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center text-white shadow-sm">
              <span className="text-sm font-bold">BM</span>
            </div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              BurgerMusic OS
            </h2>
          </div>
        </div>

        {/* 2. NAVIGATION SECTION */}
        <nav className="flex-1 px-4 space-y-4 overflow-y-auto pt-2 scrollbar-hide">
          {MENU_GROUPS.map((group) => {
            const isExpanded = expandedGroups.includes(group.name);

            return (
              <div key={group.name} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center justify-between px-2 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hover:text-white transition-colors"
                >
                  {group.name}
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`}
                  />
                </button>

                {isExpanded && (
                  <div className="space-y-0.5 animate-in slide-in-from-top-1 duration-200">
                    {group.items.map((item) => {
                      const isActive =
                        pathname === item.href || pathname.startsWith(item.href + "/");
                      const Icon = item.icon;
                      const isInventory = item.href === "/dashboard/inventory";

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch={true}
                          onClick={() => setIsOpen(false)}
                          className={`
                                                      flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-300 text-sm font-medium
                                                      ${
                                                        isActive
                                                          ? "bg-indigo-500/10 text-indigo-400 shadow-[inset_2px_0_0_0_currentColor] bg-gradient-to-r from-indigo-500/10 to-transparent"
                                                          : "text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-1"
                                                      }
                                                  `}
                        >
                          <Icon
                            size={16}
                            className={
                              isActive
                                ? "text-indigo-400"
                                : "text-slate-500 group-hover:text-slate-300"
                            }
                          />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* 3. USER PROFILE & LOGOUT */}
        <div className="p-4 mt-auto">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-slate-300 border border-slate-700">
              <User size={16} />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.name || "Gabriel Naveiro"}</p>
              <p className="text-[11px] font-bold tracking-widest uppercase text-emerald-500 truncate">
                {user?.role === 'C_LEVEL' ? 'C-Level Director' : (user?.role || 'User')}
              </p>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-md transition-all text-sm font-medium"
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden animate-in fade-in duration-300"
        />
      )}
    </>
  );
}
