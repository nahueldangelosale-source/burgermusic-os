import { redirect } from "next/navigation";
import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import { db } from "@/db";
import { zombie_shift_audits } from "@/db/schema/finance";
import { eq, and } from "drizzle-orm";
import { AuditLockdownModal } from "./cfo/AuditLockdownModal";

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

  // 1.5 Zombie Shift Sentinel (Zero-Trust Interceptor)
  const pendingAudits = await db
    .select()
    .from(zombie_shift_audits)
    .where(
      and(
        eq(zombie_shift_audits.store_id, session.user.storeId as string),
        eq(zombie_shift_audits.status, "PENDING")
      )
    )
    .limit(1);

  const pendingAudit = pendingAudits[0];

  // 2. Exoesqueleto UI
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#f8f9fc] w-full font-sans overflow-hidden">
      {pendingAudit && (
        <AuditLockdownModal
          auditId={pendingAudit.id}
          targetDate={pendingAudit.target_date}
          marginPercent={pendingAudit.reported_margin_percent / 100}
        />
      )}
      <Sidebar user={session.user} />
      <main className="flex-1 lg:ml-72 bg-[#f8f9fc] min-h-screen relative">
        <Suspense fallback={<div className="h-1 bg-blue-500/20 w-full animate-pulse" />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
