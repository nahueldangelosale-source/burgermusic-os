import { type ClassValue, clsx } from "clsx";
import type React from "react";
import { twMerge } from "tailwind-merge";

// Utilidad para fusionar clases
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 1. Átomo: Glass Card
// "Ingravidez": Fondo semitransparente, blur, borde sutil.
export function GlassCard({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-white/70 backdrop-blur-md border border-white/40 shadow-glass rounded-2xl overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

// 2. Átomo: Kitchen Button
// "Mate de Alto Contraste": Sin transparencia, slate-900, feedback táctil.
interface KitchenButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function KitchenButton({ children, className, ...props }: KitchenButtonProps) {
  return (
    <button
      className={cn(
        "h-14 w-full bg-ink-900 text-white font-bold text-lg uppercase tracking-wide rounded-lg shadow-kitchen transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// 3. Átomo: Variance Badge
// "Coral de Intervención" vs "Profit Emerald". Font-mono.
export function VarianceBadge({ value }: { value: number }) {
  const isNegative = value < 0;
  const isZero = value === 0;

  const isProfit = value > 0;

  // Si la varianza es muy pequeña, la consideramos neutra/cero
  if (Math.abs(value) < 0.05) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 font-mono">
        OK
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono",
        isNegative
          ? "bg-rose-100 text-critical" // Coral de intervención
          : "bg-emerald-100 text-emerald-700", // Profit
      )}
    >
      {isNegative ? "" : "+"}
      {value.toFixed(2)}
    </span>
  );
}

// 4. Átomo: Smart Input
// "Flotante": Sin borde visible, sombra interior al foco, ring de marca.
interface SmartInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function SmartInput({ className, ...props }: SmartInputProps) {
  return (
    <input
      className={cn(
        "w-full px-4 py-3 bg-white rounded-lg shadow-sm border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-DEFAULT focus:shadow-inner transition-all placeholder:text-slate-400 text-ink-900",
        className,
      )}
      {...props}
    />
  );
}
// 5. Átomo: Stack Card (Recipe Lab)
// "Tarjeta Apilable": Sombra intensa, borde sutil, interacción de hover.
export function StackCard({
  children,
  className,
  onClick,
  active,
}: { children: React.ReactNode; className?: string; onClick?: () => void; active?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-white border border-slate-200 rounded-xl p-4 shadow-sm transition-all cursor-pointer select-none",
        "hover:shadow-md hover:-translate-y-1 hover:border-brand-200",
        active && "border-brand-500 ring-2 ring-brand-100 shadow-lg -translate-y-1",
        className,
      )}
    >
      {active && (
        <div className="absolute -top-3 -right-3 bg-brand-500 text-white rounded-full p-1 shadow-sm animate-in zoom-in">
          <svg /* Check Icon */
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      )}
      {children}
    </div>
  );
}

// 6. Átomo: Quantity Stepper (Recipe Lab)
// "Control Táctil": Botones grandes, sin bordes molestos.
export function QuantityStepper({
  value,
  onChange,
  unit,
}: { value: number; onChange: (val: number) => void; unit: string }) {
  return (
    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onChange(Math.max(0, value - 0.1));
        }}
        className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-red-500 hover:shadow-sm transition-all font-bold text-lg active:scale-95"
      >
        -
      </button>
      <div className="min-w-[4rem] text-center">
        <div className="text-lg font-black text-ink-900 leading-none">
          {value.toFixed(1).replace(".0", "")}
        </div>
        <div className="text-[10px] uppercase font-bold text-slate-400 leading-none mt-0.5">
          {unit}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onChange(value + 0.1);
        }}
        className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-green-600 hover:shadow-sm transition-all font-bold text-lg active:scale-95"
      >
        +
      </button>
    </div>
  );
}
