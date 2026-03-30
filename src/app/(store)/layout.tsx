import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  
  if (!token) redirect("/login");

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#f8f9fc] w-full font-sans">
      <Sidebar />
      <main className="flex-1 lg:ml-72 bg-[#f8f9fc] min-h-screen relative">
        <Suspense fallback={<div className="h-1 bg-blue-500/20 w-full animate-pulse" />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
