import { redirect } from "next/navigation";
import { cookies } from "next/headers";

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  
  try {
    return JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

// Oráculo de Despacho O(1)
export default async function DispatchOracle() {
  const session = await getSession();
  
  if (!session) redirect("/login");
  if (session.role === "C_LEVEL") redirect("/dashboard/command-center");
  if (session.role === "MANAGER") redirect("/operations");
  if (session.role === "KITCHEN") redirect("/kitchen");
  
  // Default purge redirection
  redirect("/login");
}
