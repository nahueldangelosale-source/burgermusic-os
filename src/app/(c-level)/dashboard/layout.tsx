import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";

export default async function CLevelDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Oráculo de Despacho Zero-Trust 2026 (JOSE)
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  
  if (!session || !session.user) {
    redirect("/login");
  }

  if (session.user.role !== "C_LEVEL" && session.user.role !== "OWNER_GLOBAL") {
    redirect("/"); // Expulsión milisegundos si no es holding ejecutivo
  }

  // 2. Exoesqueleto UI
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#f8f9fc] w-full font-sans">
      <Sidebar user={session.user} />
      <main className="flex-1 lg:ml-72 bg-[#f8f9fc] min-h-screen relative">
        <Suspense fallback={<div className="h-1 bg-blue-500/20 w-full animate-pulse" />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
