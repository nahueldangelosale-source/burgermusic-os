import AuditDashboard from "@/components/AuditDashboard";
import { getAuditData, getAnalyticsData } from "@/app/dashboard/actions";

export default async function DashboardPage() {
    const data = await getAuditData();
    const analyticsData = await getAnalyticsData();
    return <AuditDashboard initialData={data} analyticsData={analyticsData} />;
}
