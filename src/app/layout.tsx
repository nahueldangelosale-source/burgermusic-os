import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "BurgerMusic OS",
  description: "Sistema Operativo Financiero",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
      </head>
      {/* 
        El body es el canvas global absoluto.
        Eliminamos fondos oscuros globales forzados y sidebars zombis duplicados.
        Cada Route Group dictará su propia arquitectura (BgLight, etc)
      */}
      <body
        className={`${inter.className} min-h-screen bg-[#f8f9fc] text-slate-800 flex flex-col antialiased select-none overflow-x-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
