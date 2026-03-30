import { context, trace } from "@opentelemetry/api";
import pino from "pino";

/**
 * Semantic JSON Logger for BurgerMusic.
 * Uses Pino for fast JSON logging and injects OpenTelemetry trace context.
 */
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label: string) => {
      return { severity: label.toUpperCase() };
    },
    bindings: () => {
      return {}; // Remove pid and hostname to reduce noise
    },
  },
  // In development, we can use pino-pretty. In production, pure JSON.
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        singleLine: true,
      },
    },
  }),
});

export const logger = {
  // Injects current OTel trace_id and span_id into log metadata
  _getTraceContext() {
    const currentSpan = trace.getSpan(context.active());
    if (currentSpan) {
      const spanContext = currentSpan.spanContext();
      return {
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
      };
    }
    return {};
  },

  info(message: string, meta: Record<string, any> = {}) {
    pinoLogger.info({ ...this._getTraceContext(), ...meta }, message);
  },

  warn(message: string, meta: Record<string, any> = {}) {
    pinoLogger.warn({ ...this._getTraceContext(), ...meta }, message);
  },

  error(message: string, meta: Record<string, any> = {}) {
    pinoLogger.error({ ...this._getTraceContext(), ...meta }, message);
  },

  debug(message: string, meta: Record<string, any> = {}) {
    pinoLogger.debug({ ...this._getTraceContext(), ...meta }, message);
  },
};
