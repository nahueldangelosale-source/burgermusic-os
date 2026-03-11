import AuditDashboard from "@/components/AuditDashboard";
import { getAuditData, getAnalyticsData, getFinancialMetrics } from "@/app/dashboard/actions";

export default async function DashboardPage() {
    const data = await getAuditData();
    const analyticsData = await getAnalyticsData();
    const financialData = await getFinancialMetrics();
    return <AuditDashboard initialData={data} analyticsData={analyticsData} financialData={financialData} />;
}
