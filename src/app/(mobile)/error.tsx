"use client";
import { useEffect } from "react";

export default function MobileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
      <div className="text-red-500 text-6xl mb-4">⚠️</div>
      <h2 className="text-2xl font-bold mb-4 text-white">MOBILE EXCEPTION</h2>
      <button onClick={() => reset()} className="px-6 py-2 bg-red-600 rounded">
        Retry
      </button>
    </div>
  );
}
