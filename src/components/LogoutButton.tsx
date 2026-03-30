"use client";

import { logout } from "@/lib/auth"; // We need to expose this as action or use API
import { LogOut } from "lucide-react";
// Since `logout` in lib/auth uses cookies(), it can be a server action.
// Let's create a server action wrapper for it.

import { handleLogout } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <button
      onClick={() => handleLogout()}
      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
      title="Cerrar Sesión"
    >
      <LogOut size={18} />
    </button>
  );
}
