/**
 * Structured JSON logging with OpenTelemetry trace correlation.
 *
 * This module provides a log bridge that reads the current OTel context
 * and injects traceId/spanId into pino log entries automatically.
 *
 * The core logger at `@/lib/logger` already integrates the OTel mixin;
 * this module re-exports it and provides additional helpers for creating
 * scoped child loggers with service context.
 */
import pino, { Logger, DestinationStream, LoggerOptions } from "pino";
import { trace, context, Span } from "@opentelemetry/api";

/**
 * Extracts OTel trace context from the current active span.
 *
 * Returns an object with `trace_id` and `span_id` if a span is active,
 * or an empty object otherwise.
 */
export function extractTraceContext(): Record<string, string> {
  const span: Span | undefined = trace.getSpan(context.active());
  if (span) {
    const spanCtx = span.spanContext();
    return {
      trace_id: spanCtx.traceId,
      span_id: spanCtx.spanId,
    };
  }
  return {};
}

export interface TelemetryLoggerOptions {
  /** Logger name / component scope. Defaults to "prd-web-agent". */
  name?: string;
  /** Minimum log level. Defaults to LOG_LEVEL env var or "info". */
  level?: string;
  /** Optional writable destination (useful for testing). */
  destination?: DestinationStream;
}

/**
 * Creates a pino logger with structured JSON output and automatic
 * OTel trace context injection.
 *
 * Every log entry includes:
 * - `level` as a human-readable string
 * - `service` field from the `name` option
 * - `trace_id` and `span_id` when an OTel span is active
 */
export function createTelemetryLogger(
  opts?: TelemetryLoggerOptions,
): Logger {
  const level = opts?.level ?? process.env.LOG_LEVEL ?? "info";
  const service = opts?.name ?? "prd-web-agent";

  const pinoOpts: LoggerOptions = {
    level,
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    mixin() {
      return {
        service,
        ...extractTraceContext(),
      };
    },
  };

  if (opts?.destination) {
    return pino(pinoOpts, opts.destination);
  }

  return pino(pinoOpts);
}

/**
 * Default telemetry-aware logger instance.
 */
const telemetryLogger = createTelemetryLogger();

export default telemetryLogger;
