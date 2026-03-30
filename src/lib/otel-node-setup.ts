/**
 * OTel Node.js Setup — Heavy SDK Initialization
 * ───────────────────────────────────────────────
 * This file contains ALL OpenTelemetry Node.js-specific imports.
 * It MUST ONLY be loaded via dynamic import() from instrumentation.ts
 * when process.env.NEXT_RUNTIME === 'nodejs'.
 *
 * This prevents Turbopack/Edge from attempting to bundle Node-only
 * dependencies like @opentelemetry/sdk-node, which crash with
 * __import_unsupported errors in Edge contexts.
 */

import type { Attributes, Context, Link, SpanKind } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ConsoleSpanExporter,
  type Sampler,
  SamplingDecision,
  type SamplingResult,
} from "@opentelemetry/sdk-trace-node";

// ────────────────────────────────────────────
// SmartFinOpsSampler (Tail-Based Approximation)
// ────────────────────────────────────────────

class SmartFinOpsSampler implements Sampler {
  private readonly baseRate: number;
  private readonly alwaysSamplePrefixes: string[];

  constructor(baseRate = 0.05) {
    this.baseRate = baseRate;
    this.alwaysSamplePrefixes = ["burgermusic-genai", "airlock-dispatcher", "agentic-gateway"];
  }

  shouldSample(
    _context: Context,
    _traceId: string,
    spanName: string,
    _spanKind: SpanKind,
    attributes: Attributes,
    _links: Link[],
  ): SamplingResult {
    for (const prefix of this.alwaysSamplePrefixes) {
      if (spanName.toLowerCase().includes(prefix)) {
        return { decision: SamplingDecision.RECORD_AND_SAMPLED };
      }
    }

    const httpStatus = attributes?.["http.status_code"];
    if (typeof httpStatus === "number" && httpStatus >= 400) {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED };
    }

    if (spanName.includes("GenAI") || spanName.includes("generate")) {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED };
    }

    if (Math.random() < this.baseRate) {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED };
    }

    return { decision: SamplingDecision.NOT_RECORD };
  }

  toString(): string {
    return `SmartFinOpsSampler(baseRate=${this.baseRate})`;
  }
}

// ────────────────────────────────────────────
// SDK Bootstrap
// ────────────────────────────────────────────

export function bootstrapOTel() {
  const sampler = new SmartFinOpsSampler(Number.parseFloat(process.env.OTEL_SAMPLE_RATE || "0.05"));

  const sdk = new NodeSDK({
    sampler,
    traceExporter: new ConsoleSpanExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy/irrelevant instrumentations for Vercel/Turso
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-aws-lambda": { enabled: false },
        "@opentelemetry/instrumentation-aws-sdk": { enabled: false },
      }),
    ],
  });

  sdk.start();

  console.log(
    JSON.stringify({
      severity: "INFO",
      component: "OTelSDK",
      sampler: sampler.toString(),
      exporter: "ConsoleSpanExporter",
      message: "OpenTelemetry NodeSDK started with FinOps sampling",
    }),
  );
}
