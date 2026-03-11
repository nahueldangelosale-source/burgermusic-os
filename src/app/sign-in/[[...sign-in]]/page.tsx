import { SignIn } from "@clerk/nextjs";

export default function Page() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-12 bg-slate-50">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-black uppercase text-ink-900 tracking-tighter">
                    BurgerMusic <span className="text-brand-500">OS</span>
                </h1>
                <p className="text-slate-500 font-medium">Sistema Operativo Gastronómico</p>
            </div>
            <SignIn />
        </div>
    );
}
