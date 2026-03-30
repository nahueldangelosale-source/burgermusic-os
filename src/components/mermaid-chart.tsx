"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Mermaid Chart — Lazy-loaded via dynamic import()
 * ─────────────────────────────────────────────────
 * The `mermaid` library is ~2.5MB. Static import at the top-level
 * inflates the client bundle catastrophically. By using dynamic
 * import(), the library is only fetched when this component mounts,
 * keeping the initial JS payload lean.
 */
export function MermaidChart({ chart, id }: { chart: string; id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const renderChart = async () => {
      // Dynamic import — mermaid only loads when this component renders
      const mermaid = (await import("mermaid")).default;

      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          fontFamily: "inherit",
          primaryColor: "rgba(37, 99, 235, 0.2)",
          primaryTextColor: "#F8FAFC",
          primaryBorderColor: "rgba(59, 130, 246, 0.5)",
          lineColor: "rgba(255, 255, 255, 0.3)",
          secondaryColor: "rgba(16, 185, 129, 0.2)",
          tertiaryColor: "rgba(244, 63, 94, 0.2)",
          nodeBorder: "rgba(255, 255, 255, 0.2)",
          clusterBkg: "rgba(0,0,0,0.2)",
          clusterBorder: "rgba(255,255,255,0.1)",
          mainBkg: "transparent",
        },
        flowchart: {
          curve: "basis",
          htmlLabels: true,
          padding: 20,
        },
      });

      if (ref.current && !cancelled) {
        try {
          const { svg } = await mermaid.render(`mermaid-svg-${id}`, chart);
          if (!cancelled && ref.current) {
            ref.current.innerHTML = svg;

            const svgElement = ref.current.querySelector("svg");
            if (svgElement) {
              svgElement.style.filter = "drop-shadow(0px 8px 16px rgba(0,0,0,0.4))";
              const nodes = svgElement.querySelectorAll(".node rect, .node circle, .node polygon");
              nodes.forEach((node: any) => {
                node.style.strokeWidth = "1.5px";
              });
            }
            setRendered(true);
          }
        } catch (error) {
          console.error("Mermaid parsing error:", error);
        }
      }
    };

    renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  return (
    <div className="w-full h-full min-h-[250px] flex items-center justify-center relative">
      {!rendered && <Loader2 className="animate-spin text-primary absolute" size={32} />}
      <div
        ref={ref}
        className="w-full flex justify-center overflow-x-auto overflow-y-hidden pb-4"
      />
    </div>
  );
}
