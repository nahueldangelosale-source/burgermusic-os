/**
 * GenAI OTel Span Wrapper — LLM Observability
 * ─────────────────────────────────────────────
 * Wraps any GenAI / LLM call with an OpenTelemetry span that follows
 * the official Semantic Conventions for Generative AI:
 *   https://opentelemetry.io/docs/specs/semconv/gen-ai/
 *
 * Attributes recorded:
 *   gen_ai.system           — "google_genai" | "openai" | etc.
 *   gen_ai.request.model    — e.g. "gemini-1.5-flash"
 *   gen_ai.usage.input_tokens
 *   gen_ai.usage.output_tokens
 *
 * Span Events:
 *   gen_ai.prompt           — sanitized user prompt
 *   gen_ai.completion       — sanitized model response
 */

import { logger } from "@/lib/logger";
import { sanitizePII } from "@/lib/pii-sanitizer";
import { SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("burgermusic-genai", "1.0.0");

export interface GenAICallOptions {
  /** The AI system: "google_genai", "openai", etc. */
  system: string;
  /** Model identifier, e.g. "gemini-1.5-flash" */
  model: string;
  /** Human-readable operation name for the span */
  operationName: string;
  /** The user prompt text (will be PII-sanitized before recording) */
  promptText: string;
}

export interface GenAICallResult {
  /** Raw response text from the model */
  responseText: string;
  /** Token usage reported by the model (if available) */
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Wraps a GenAI call, recording an OTel span with semantic attributes
 * and PII-sanitized prompt/completion events.
 *
 * @param options  — metadata about the call
 * @param fn       — the actual async function that calls the model
 * @returns        the return value of `fn`
 */
export async function withGenAITrace<T>(
  options: GenAICallOptions,
  fn: () => Promise<{ result: T; telemetry: GenAICallResult }>,
): Promise<T> {
  return tracer.startActiveSpan(options.operationName, async (span) => {
    // Set semantic attributes
    span.setAttribute("gen_ai.system", options.system);
    span.setAttribute("gen_ai.request.model", options.model);

    // Record sanitized prompt as a span event
    span.addEvent("gen_ai.prompt", {
      "gen_ai.prompt.content": sanitizePII(options.promptText).substring(0, 2000),
    });

    try {
      const { result, telemetry } = await fn();

      // Record token usage
      if (telemetry.inputTokens !== undefined) {
        span.setAttribute("gen_ai.usage.input_tokens", telemetry.inputTokens);
      }
      if (telemetry.outputTokens !== undefined) {
        span.setAttribute("gen_ai.usage.output_tokens", telemetry.outputTokens);
      }

      // Record sanitized completion as a span event
      span.addEvent("gen_ai.completion", {
        "gen_ai.completion.content": sanitizePII(telemetry.responseText).substring(0, 2000),
      });

      // FinOps: log token cost for downstream aggregation
      logger.info("GenAI call completed", {
        component: "GenAI",
        model: options.model,
        operation: options.operationName,
        inputTokens: telemetry.inputTokens ?? 0,
        outputTokens: telemetry.outputTokens ?? 0,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown GenAI error";
      span.setStatus({ code: SpanStatusCode.ERROR, message: msg });
      span.recordException(error instanceof Error ? error : new Error(msg));
      span.end();

      logger.error("GenAI call failed", {
        component: "GenAI",
        model: options.model,
        operation: options.operationName,
        error: msg,
      });

      throw error;
    }
  });
}
