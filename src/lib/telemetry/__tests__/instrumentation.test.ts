import { SpanStatusCode } from "@opentelemetry/api";

// ---------------------------------------------------------------------------
// Mock the OTel API so we can inspect span creation and attributes.
// ---------------------------------------------------------------------------

const mockEnd = jest.fn();
const mockSetStatus = jest.fn();
const mockSetAttribute = jest.fn();
const mockSetAttributes = jest.fn();
const mockRecordException = jest.fn();

const mockSpan = {
  end: mockEnd,
  setStatus: mockSetStatus,
  setAttribute: mockSetAttribute,
  setAttributes: mockSetAttributes,
  recordException: mockRecordException,
  spanContext: () => ({
    traceId: "0af7651916cd43dd8448eb211c80319c",
    spanId: "b7ad6b7169203331",
    traceFlags: 1,
  }),
};

const mockStartActiveSpan = jest.fn(
  (_name: string, _opts: unknown, fn: (span: typeof mockSpan) => unknown) => {
    return fn(mockSpan);
  },
);

jest.mock("@opentelemetry/api", () => {
  const actual = jest.requireActual("@opentelemetry/api");
  return {
    ...actual,
    trace: {
      getTracer: () => ({
        startActiveSpan: mockStartActiveSpan,
      }),
    },
  };
});

// We also need to mock next/server to avoid pulling in the full Next.js runtime.
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

import {
  withSpan,
  withApiTrace,
  withDbSpan,
  withExternalCallSpan,
  withSessionSpan,
} from "@/lib/telemetry/instrumentation";

describe("TASK-047: Trace instrumentation helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // withSpan
  // -----------------------------------------------------------------------

  describe("withSpan", () => {
    it("should create a span and return the function result", async () => {
      const result = await withSpan("test-span", async () => 42);

      expect(mockStartActiveSpan).toHaveBeenCalledWith(
        "test-span",
        expect.objectContaining({}),
        expect.any(Function),
      );
      expect(result).toBe(42);
      expect(mockSetStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.OK,
      });
      expect(mockEnd).toHaveBeenCalled();
    });

    it("should set ERROR status and record exception on failure", async () => {
      const error = new Error("boom");

      await expect(
        withSpan("failing-span", async () => {
          throw error;
        }),
      ).rejects.toThrow("boom");

      expect(mockSetStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: "boom",
      });
      expect(mockRecordException).toHaveBeenCalledWith(error);
      expect(mockEnd).toHaveBeenCalled();
    });

    it("should forward custom attributes", async () => {
      await withSpan(
        "attr-span",
        async () => "ok",
        { "custom.attr": "value" },
      );

      expect(mockStartActiveSpan).toHaveBeenCalledWith(
        "attr-span",
        expect.objectContaining({
          attributes: { "custom.attr": "value" },
        }),
        expect.any(Function),
      );
    });
  });

  // -----------------------------------------------------------------------
  // withApiTrace
  // -----------------------------------------------------------------------

  describe("withApiTrace", () => {
    it("should wrap a route handler with a span", async () => {
      const handler = jest.fn().mockResolvedValue({ status: 200 });
      const traced = withApiTrace("/api/test", handler);

      const fakeRequest = { method: "GET" } as Request;
      const response = await traced(fakeRequest);

      expect(handler).toHaveBeenCalledWith(fakeRequest, undefined);
      expect(mockSetAttribute).toHaveBeenCalledWith("http.method", "GET");
      expect(mockSetAttribute).toHaveBeenCalledWith(
        "http.route",
        "/api/test",
      );
      expect(mockSetAttribute).toHaveBeenCalledWith("http.status_code", 200);
      expect(response).toEqual({ status: 200 });
    });
  });

  // -----------------------------------------------------------------------
  // withDbSpan
  // -----------------------------------------------------------------------

  describe("withDbSpan", () => {
    it("should create a span with db attributes", async () => {
      const result = await withDbSpan("findMany", "Prd", async () => [
        { id: 1 },
      ]);

      expect(result).toEqual([{ id: 1 }]);
      expect(mockStartActiveSpan).toHaveBeenCalledWith(
        "db.findMany Prd",
        expect.any(Object),
        expect.any(Function),
      );
      expect(mockSetAttribute).toHaveBeenCalledWith("db.system", "prisma");
      expect(mockSetAttribute).toHaveBeenCalledWith(
        "db.operation",
        "findMany",
      );
      expect(mockSetAttribute).toHaveBeenCalledWith("db.sql.table", "Prd");
    });
  });

  // -----------------------------------------------------------------------
  // withExternalCallSpan
  // -----------------------------------------------------------------------

  describe("withExternalCallSpan", () => {
    it("should create a span with external call attributes", async () => {
      const result = await withExternalCallSpan(
        "github",
        "https://api.github.com/repos/org/repo/pulls",
        async () => ({ number: 42 }),
      );

      expect(result).toEqual({ number: 42 });
      expect(mockStartActiveSpan).toHaveBeenCalledWith(
        "external.github",
        expect.any(Object),
        expect.any(Function),
      );
      expect(mockSetAttribute).toHaveBeenCalledWith("peer.service", "github");
      expect(mockSetAttribute).toHaveBeenCalledWith(
        "http.url",
        "https://api.github.com/repos/org/repo/pulls",
      );
    });
  });

  // -----------------------------------------------------------------------
  // withSessionSpan
  // -----------------------------------------------------------------------

  describe("withSessionSpan", () => {
    it("should create a span for session create lifecycle", async () => {
      await withSessionSpan("sess-123", "create", async () => undefined);

      expect(mockStartActiveSpan).toHaveBeenCalledWith(
        "agent.session.create",
        expect.any(Object),
        expect.any(Function),
      );
      expect(mockSetAttribute).toHaveBeenCalledWith(
        "agent.session.id",
        "sess-123",
      );
      expect(mockSetAttribute).toHaveBeenCalledWith(
        "agent.session.lifecycle",
        "create",
      );
    });

    it("should create a span for session message lifecycle", async () => {
      await withSessionSpan("sess-456", "message", async () => "response");

      expect(mockStartActiveSpan).toHaveBeenCalledWith(
        "agent.session.message",
        expect.any(Object),
        expect.any(Function),
      );
    });

    it("should create a span for session evict lifecycle", async () => {
      await withSessionSpan("sess-789", "evict", async () => undefined);

      expect(mockStartActiveSpan).toHaveBeenCalledWith(
        "agent.session.evict",
        expect.any(Object),
        expect.any(Function),
      );
    });
  });
});
