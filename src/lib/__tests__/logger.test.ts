describe("logger", () => {
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.LOG_LEVEL;
  });

  afterAll(() => {
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });

  it("should export a pino logger instance", async () => {
    const mod = await import("@/lib/logger");
    const logger = mod.default;

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("should produce JSON output with expected fields", async () => {
    const chunks: string[] = [];
    const { createLogger } = await import("@/lib/logger");

    const testLogger = createLogger({
      destination: {
        write(msg: string) {
          chunks.push(msg);
          return true;
        },
      },
    });

    testLogger.info({ foo: "bar" }, "test message");

    expect(chunks.length).toBeGreaterThan(0);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed).toHaveProperty("level");
    expect(parsed).toHaveProperty("time");
    expect(parsed).toHaveProperty("msg", "test message");
    expect(parsed).toHaveProperty("foo", "bar");
  });

  it("should include trace_id and span_id when a span is active", async () => {
    const fakeTraceId = "abc123def456abc123def456abc123de";
    const fakeSpanId = "1234567890abcdef";

    // Mock the @opentelemetry/api module before importing the logger,
    // so the logger's mixin picks up our fake span.
    jest.doMock("@opentelemetry/api", () => {
      const fakeSpan = {
        spanContext: () => ({
          traceId: fakeTraceId,
          spanId: fakeSpanId,
          traceFlags: 1,
        }),
      };
      return {
        trace: {
          getSpan: jest.fn().mockReturnValue(fakeSpan),
          getTracer: jest.fn(),
        },
        context: {
          active: jest.fn().mockReturnValue({}),
        },
      };
    });

    const chunks: string[] = [];
    const { createLogger } = await import("@/lib/logger");

    const testLogger = createLogger({
      destination: {
        write(msg: string) {
          chunks.push(msg);
          return true;
        },
      },
    });

    testLogger.info("message with trace context");

    expect(chunks.length).toBeGreaterThan(0);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed).toHaveProperty("trace_id", fakeTraceId);
    expect(parsed).toHaveProperty("span_id", fakeSpanId);
  });

  it("should not include trace fields when no span is active", async () => {
    // Ensure the OTel mock from a previous test is cleared
    jest.dontMock("@opentelemetry/api");
    jest.resetModules();

    const chunks: string[] = [];
    const { createLogger } = await import("@/lib/logger");

    const testLogger = createLogger({
      destination: {
        write(msg: string) {
          chunks.push(msg);
          return true;
        },
      },
    });

    testLogger.info("message without trace context");

    expect(chunks.length).toBeGreaterThan(0);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed).not.toHaveProperty("trace_id");
    expect(parsed).not.toHaveProperty("span_id");
  });

  it("should respect LOG_LEVEL environment variable", async () => {
    process.env.LOG_LEVEL = "warn";
    const { createLogger } = await import("@/lib/logger");

    const chunks: string[] = [];
    const testLogger = createLogger({
      destination: {
        write(msg: string) {
          chunks.push(msg);
          return true;
        },
      },
    });

    testLogger.info("should not appear");
    testLogger.warn("should appear");

    expect(chunks.length).toBe(1);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed.msg).toBe("should appear");
  });
});
