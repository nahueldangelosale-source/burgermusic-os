"use client";

import React, { useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { z } from "zod";

// Zod Schema
const InventoryRowSchema = z.object({
  id: z.string(),
  insumo: z.string(),
  stockInicial: z.number(),
  consumoBom: z.number(),
  conteoCiego: z.number(),
  varianza: z.number(),
});

export type InventoryRow = z.infer<typeof InventoryRowSchema>;

export function VirtualizedInventoryGrid({ data }: { data: InventoryRow[] }) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const columns = React.useMemo<ColumnDef<InventoryRow>[]>(
    () => [
      { accessorKey: "insumo", header: "Insumo" },
      { accessorKey: "stockInicial", header: "Stock Inicial (g)" },
      { accessorKey: "consumoBom", header: "Consumo BOM (g)" },
      { accessorKey: "conteoCiego", header: "Conteo Ciego (g)" },
      {
        accessorKey: "varianza",
        header: "Varianza %",
        cell: (info) => {
          const val = info.getValue() as number;
          let colorClass = "text-emerald-400";
          if (val < -5) colorClass = "text-red-500 font-bold";
          else if (val < -2) colorClass = "text-amber-400";
          
          return <span className={`font-mono ${colorClass}`}>{val}%</span>;
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 45, // Altura estimada fila O(1)
    overscan: 10,
  });

  return (
    <div
      ref={tableContainerRef}
      className="h-[500px] overflow-auto border border-zinc-800 rounded-xl bg-[oklch(0.98_0.01_250)]/5 backdrop-blur-md"
    >
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        <table className="w-full text-left text-sm text-zinc-100">
          <thead className="sticky top-0 z-10 bg-zinc-900/90 backdrop-blur-md ring-1 ring-zinc-800 uppercase tracking-widest text-xs font-mono text-zinc-400">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="p-4">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function KitchenLogsTimeline({ logs }: { logs: { time: string; event: string }[] }) {
  return (
    <div className="flex flex-col gap-4 border-l border-zinc-800 ml-4 pl-6 relative">
      {logs.map((log, i) => (
        <div key={i} className="relative">
          <div className="absolute -left-[31px] top-2 w-3 h-3 bg-red-500/20 ring-1 ring-red-500 rounded-full" />
          <span className="text-xs font-mono text-zinc-500">{log.time}</span>
          <p className="text-sm font-medium text-zinc-200">{log.event}</p>
        </div>
      ))}
    </div>
  );
}
