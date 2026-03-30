import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function LoginPage() {
  async function fastLogin(formData: FormData) {
    "use server";
    const { encrypt } = await import("@/lib/session");
    const role = formData.get("role") as string;
    const storeId = role === "C_LEVEL" ? "global" : ""; // Should be assigned after PIN entry
    
    // Nueva Arquitectura Zero-Trust 2026: JWT Cifrado (jose)
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await encrypt({ 
      user: { 
        id: "USR_GOD_" + role,
        name: "Gabriel Naveiro", 
        role: role, 
        storeId 
      }, 
      expires 
    });
    
    const cookieStore = await cookies();
    cookieStore.set("session", session, { 
      expires, 
      httpOnly: true, 
      path: "/", 
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production"
    });
    
    redirect("/dashboard/supply");
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Neuroestético */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/40 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md bg-slate-900/60 p-10 rounded-[3rem] border border-slate-800/80 backdrop-blur-3xl shadow-2xl flex flex-col items-center relative z-10">
        <div className="w-16 h-16 bg-slate-800 rounded-3xl mb-6 flex items-center justify-center border border-slate-700 shadow-inner">
           <span className="text-3xl text-indigo-400">⚡</span>
        </div>
        
        <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase text-center w-full">IGNITION SEQUENCE</h1>
        <p className="text-slate-500 font-mono text-xs tracking-[0.2em] mb-12 text-center uppercase">UAT Fast-Login Hub O(1)</p>
        
        <form action={fastLogin} className="w-full flex flex-col gap-5">
          <button name="role" value="C_LEVEL" className="group w-full bg-indigo-600/10 hover:bg-indigo-600/30 border border-indigo-500/20 hover:border-indigo-400 text-indigo-300 font-bold py-5 rounded-[2rem] transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-3">
            <span className="w-2 h-2 rounded-full bg-indigo-500 group-hover:scale-150 transition-transform"></span>
            Executive Oracle
          </button>
          
          <button name="role" value="MANAGER" className="group w-full bg-emerald-600/10 hover:bg-emerald-600/30 border border-emerald-500/20 hover:border-emerald-400 text-emerald-300 font-bold py-5 rounded-[2rem] transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-3">
             <span className="w-2 h-2 rounded-full bg-emerald-500 group-hover:scale-150 transition-transform"></span>
             Store Commander
          </button>
          
          <button name="role" value="KITCHEN" className="group w-full bg-amber-600/10 hover:bg-amber-600/30 border border-amber-500/20 hover:border-amber-400 text-amber-300 font-bold py-5 rounded-[2rem] transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-3">
             <span className="w-2 h-2 rounded-full bg-amber-500 group-hover:scale-150 transition-transform"></span>
             Kiosk Worker
          </button>
        </form>
      </div>
    </div>
  );
}
