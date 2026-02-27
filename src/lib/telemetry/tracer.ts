import { trace, Tracer } from "@opentelemetry/api";

/**
 * Returns an OpenTelemetry Tracer for the given instrumentation scope name.
 *
 * Safe to call even when no OTel SDK is initialized — the API will return
 * a no-op tracer that silently drops all spans.
 */
export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}
