describe("TASK-049: Structured JSON Logging with OTel Correlation", () => {
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

  // -----------------------------------------------------------------------
  // extractTraceContext
  // -----------------------------------------------------------------------

  describe("extractTraceContext", () => {
    it("should return trace_id and span_id when a span is active", async () => {
      const fakeTraceId = "0af7651916cd43dd8448eb211c80319c";
      const fakeSpanId = "b7ad6b7169203331";

      jest.doMock("@opentelemetry/api", () => ({
        trace: {
          getSpan: jest.fn().mockReturnValue({
            spanContext: () => ({
              traceId: fakeTraceId,
              spanId: fakeSpanId,
              traceFlags: 1,
            }),
          }),
        },
        context: {
          active: jest.fn().mockReturnValue({}),
        },
      }));

      const { extractTraceContext } = await import(
        "@/lib/telemetry/logger"
      );
      const ctx = extractTraceContext();

      expect(ctx).toEqual({
        trace_id: fakeTraceId,
        span_id: fakeSpanId,
      });
    });

    it("should return empty object when no span is active", async () => {
      jest.dontMock("@opentelemetry/api");
      jest.resetModules();

      const { extractTraceContext } = await import(
        "@/lib/telemetry/logger"
      );
      const ctx = extractTraceContext();

      expect(ctx).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // createTelemetryLogger
  // -----------------------------------------------------------------------

  describe("createTelemetryLogger", () => {
    it("should produce JSON output with service field", async () => {
      jest.dontMock("@opentelemetry/api");
      jest.resetModules();

      const chunks: string[] = [];
      const { createTelemetryLogger } = await import(
        "@/lib/telemetry/logger"
      );

      const logger = createTelemetryLogger({
        name: "test-service",
        destination: {
          write(msg: string) {
            chunks.push(msg);
            return true;
          },
        },
      });

      logger.info({ key: "value" }, "hello");

      expect(chunks.length).toBeGreaterThan(0);
      const parsed = JSON.parse(chunks[0]);
      expect(parsed).toHaveProperty("level", "info");
      expect(parsed).toHaveProperty("service", "test-service");
      expect(parsed).toHaveProperty("msg", "hello");
      expect(parsed).toHaveProperty("key", "value");
    });

    it("should inject trace_id and span_id when span is active", async () => {
      const fakeTraceId = "aaaabbbbccccddddeeeeffffaaaabbbb";
      const fakeSpanId = "1111222233334444";

      jest.doMock("@opentelemetry/api", () => ({
        trace: {
          getSpan: jest.fn().mockReturnValue({
            spanContext: () => ({
              traceId: fakeTraceId,
              spanId: fakeSpanId,
              traceFlags: 1,
            }),
          }),
        },
        context: {
          active: jest.fn().mockReturnValue({}),
        },
      }));

      const chunks: string[] = [];
      const { createTelemetryLogger } = await import(
        "@/lib/telemetry/logger"
      );

      const logger = createTelemetryLogger({
        destination: {
          write(msg: string) {
            chunks.push(msg);
            return true;
          },
        },
      });

      logger.info("traced message");

      expect(chunks.length).toBeGreaterThan(0);
      const parsed = JSON.parse(chunks[0]);
      expect(parsed).toHaveProperty("trace_id", fakeTraceId);
      expect(parsed).toHaveProperty("span_id", fakeSpanId);
    });

    it("should not include trace fields when no span is active", async () => {
      jest.dontMock("@opentelemetry/api");
      jest.resetModules();

      const chunks: string[] = [];
      const { createTelemetryLogger } = await import(
        "@/lib/telemetry/logger"
      );

      const logger = createTelemetryLogger({
        destination: {
          write(msg: string) {
            chunks.push(msg);
            return true;
          },
        },
      });

      logger.info("untraced message");

      expect(chunks.length).toBeGreaterThan(0);
      const parsed = JSON.parse(chunks[0]);
      expect(parsed).not.toHaveProperty("trace_id");
      expect(parsed).not.toHaveProperty("span_id");
    });

    it("should respect custom log level", async () => {
      jest.dontMock("@opentelemetry/api");
      jest.resetModules();

      const chunks: string[] = [];
      const { createTelemetryLogger } = await import(
        "@/lib/telemetry/logger"
      );

      const logger = createTelemetryLogger({
        level: "warn",
        destination: {
          write(msg: string) {
            chunks.push(msg);
            return true;
          },
        },
      });

      logger.info("should not appear");
      logger.warn("should appear");

      expect(chunks.length).toBe(1);
      const parsed = JSON.parse(chunks[0]);
      expect(parsed.msg).toBe("should appear");
    });

    it("should default service name to prd-web-agent", async () => {
      jest.dontMock("@opentelemetry/api");
      jest.resetModules();

      const chunks: string[] = [];
      const { createTelemetryLogger } = await import(
        "@/lib/telemetry/logger"
      );

      const logger = createTelemetryLogger({
        destination: {
          write(msg: string) {
            chunks.push(msg);
            return true;
          },
        },
      });

      logger.info("default service");

      const parsed = JSON.parse(chunks[0]);
      expect(parsed).toHaveProperty("service", "prd-web-agent");
    });
  });

  // -----------------------------------------------------------------------
  // Default export
  // -----------------------------------------------------------------------

  describe("default export", () => {
    it("should export a functional logger instance", async () => {
      jest.dontMock("@opentelemetry/api");
      jest.resetModules();

      const mod = await import("@/lib/telemetry/logger");
      const logger = mod.default;

      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });
  });
});
