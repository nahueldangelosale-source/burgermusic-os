"use client";

import { BarList } from "@tremor/react";

interface ClientBarListProps {
  data: any[];
  type: "currency" | "units";
  className?: string;
}

export function ClientBarList({ data, type, className }: ClientBarListProps) {
  const formatter = type === "currency" 
    ? (n: number) => Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
    : (n: number) => Intl.NumberFormat("es-AR").format(n) + " u.";

  return (
    <BarList data={data} className={className} valueFormatter={formatter} />
  );
}
