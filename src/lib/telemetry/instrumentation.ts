import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import {
  trace,
  Span,
  SpanStatusCode,
  SpanKind,
  Attributes,
} from "@opentelemetry/api";
import { NextResponse } from "next/server";

let sdk: NodeSDK | undefined;

const TRACER_NAME = "prd-web-agent";

/**
 * Initializes the OpenTelemetry NodeSDK with OTLP trace and metric exporters.
 *
 * Configuration is driven by environment variables:
 * - OTEL_SERVICE_NAME      — logical service name (default: "prd-web-agent")
 * - OTEL_EXPORTER_OTLP_ENDPOINT — collector URL (default: "http://localhost:4318")
 *
 * Safe to call when no collector is running: the OTLP exporters will fail
 * gracefully without crashing the application.
 */
export function initTelemetry(): void {
  if (sdk) {
    return; // Already initialised — avoid double-init on HMR
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || "prd-web-agent";
  const otlpEndpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${otlpEndpoint}/v1/metrics`,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60_000,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [new HttpInstrumentation()],
  });

  sdk.start();
}

// ---------------------------------------------------------------------------
// TASK-047: Trace instrumentation helpers
// ---------------------------------------------------------------------------

/**
 * Wraps an async function in an OpenTelemetry span.
 *
 * The span is automatically ended when the function resolves or rejects.
 * On error the span status is set to ERROR and the exception is recorded.
 */
export async function withSpan<T>(
  spanName: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Attributes,
): Promise<T> {
  const tracer = trace.getTracer(TRACER_NAME);
  return tracer.startActiveSpan(spanName, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Wraps a Next.js API route handler with an OpenTelemetry span.
 *
 * The span includes the HTTP method and route path as attributes and records
 * the response status code.
 */
export function withApiTrace(
  route: string,
  handler: (
    request: Request,
    context?: unknown,
  ) => Promise<NextResponse | Response>,
): (
  request: Request,
  context?: unknown,
) => Promise<NextResponse | Response> {
  return async (request: Request, context?: unknown) => {
    const method = request.method;
    return withSpan(
      `${method} ${route}`,
      async (span) => {
        span.setAttribute("http.method", method);
        span.setAttribute("http.route", route);
        span.setAttributes({ "span.kind": SpanKind.SERVER });

        const response = await handler(request, context);

        span.setAttribute("http.status_code", response.status);
        return response;
      },
    );
  };
}

/**
 * Wraps a database query function in an OpenTelemetry span.
 *
 * Sets db-specific attributes (db.system, db.operation, db.sql.table).
 */
export async function withDbSpan<T>(
  operation: string,
  table: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan(
    `db.${operation} ${table}`,
    async (span) => {
      span.setAttribute("db.system", "prisma");
      span.setAttribute("db.operation", operation);
      span.setAttribute("db.sql.table", table);
      return fn(span);
    },
  );
}

/**
 * Wraps an external API call in an OpenTelemetry span.
 *
 * Sets attributes for the target service and endpoint.
 */
export async function withExternalCallSpan<T>(
  service: string,
  endpoint: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan(
    `external.${service}`,
    async (span) => {
      span.setAttribute("peer.service", service);
      span.setAttribute("http.url", endpoint);
      span.setAttributes({ "span.kind": SpanKind.CLIENT });
      return fn(span);
    },
  );
}

/**
 * Wraps an agent session lifecycle operation in an OpenTelemetry span.
 *
 * Lifecycle events: "create", "message", "evict".
 */
export async function withSessionSpan<T>(
  sessionId: string,
  lifecycle: "create" | "message" | "evict",
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan(
    `agent.session.${lifecycle}`,
    async (span) => {
      span.setAttribute("agent.session.id", sessionId);
      span.setAttribute("agent.session.lifecycle", lifecycle);
      return fn(span);
    },
  );
}
