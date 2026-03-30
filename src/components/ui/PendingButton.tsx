"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

interface PendingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loadingText?: string;
}

export function PendingButton({ 
  children, 
  className, 
  loadingText = "Procesando...", 
  ...props 
}: PendingButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      disabled={pending || props.disabled}
      className={cn(
        "relative flex items-center justify-center gap-2 px-6 py-3 font-bold uppercase tracking-widest transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
        "bg-accent-primary text-white rounded-2xl shadow-lg hover:shadow-accent-primary/20",
        className
      )}
    >
      {pending && (
        <svg
          className="animate-spin h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      <span>{pending ? loadingText : children}</span>
    </button>
  );
}
