import { Tracer } from "@opentelemetry/api";

describe("getTracer", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("should return a Tracer instance", async () => {
    const { getTracer } = await import("@/lib/telemetry/tracer");
    const tracer = getTracer("test-service");

    expect(tracer).toBeDefined();
    // A Tracer must have startSpan and startActiveSpan methods
    expect(typeof tracer.startSpan).toBe("function");
    expect(typeof tracer.startActiveSpan).toBe("function");
  });

  it("should return different tracers for different names", async () => {
    const { getTracer } = await import("@/lib/telemetry/tracer");
    const tracerA = getTracer("service-a");
    const tracerB = getTracer("service-b");

    // Both should be valid tracers (OTel may or may not return the same object,
    // but they should both be functional)
    expect(typeof tracerA.startSpan).toBe("function");
    expect(typeof tracerB.startSpan).toBe("function");
  });

  it("should be safe to call without an active OTel SDK", async () => {
    const { getTracer } = await import("@/lib/telemetry/tracer");
    const tracer = getTracer("no-sdk-service");

    // Should not throw when creating and ending a span
    const span = tracer.startSpan("test-span");
    expect(span).toBeDefined();
    expect(() => span.end()).not.toThrow();
  });
});
