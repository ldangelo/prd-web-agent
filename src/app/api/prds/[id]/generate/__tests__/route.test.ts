/**
 * PRD generate API route tests.
 *
 * Tests for POST /api/prds/[id]/generate — SSE streaming PRD generation.
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports
// ---------------------------------------------------------------------------

const mockRequireAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

const mockPrdFindUnique = jest.fn();
const mockPrdUpdate = jest.fn();
const mockProjectMemberFindUnique = jest.fn();
const mockPrdVersionCreate = jest.fn();
const mockPrdVersionFindFirst = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findUnique: (...args: unknown[]) => mockPrdFindUnique(...args),
      update: (...args: unknown[]) => mockPrdUpdate(...args),
    },
    projectMember: {
      findUnique: (...args: unknown[]) => mockProjectMemberFindUnique(...args),
    },
    prdVersion: {
      create: (...args: unknown[]) => mockPrdVersionCreate(...args),
      findFirst: (...args: unknown[]) => mockPrdVersionFindFirst(...args),
    },
  },
}));

// AgentSessionManager mock — captured so individual tests can control behaviour
let capturedListener: ((event: { type: string; data?: unknown }) => void) | null = null;
const mockSessionId = "session_test_001";

const mockCreateSession = jest.fn();
const mockSubscribe = jest.fn();
const mockPrompt = jest.fn();
const mockDisposeAll = jest.fn();

jest.mock("@/services/agent/agent-session-manager", () => ({
  AgentSessionManager: jest.fn().mockImplementation(() => ({
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    subscribe: (...args: unknown[]) => mockSubscribe(...args),
    prompt: (...args: unknown[]) => mockPrompt(...args),
    disposeAll: (...args: unknown[]) => mockDisposeAll(...args),
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from "../route";
import { UnauthorizedError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function postRequest(url: string): Request {
  return new Request(url, { method: "POST" });
}

/**
 * Consume an SSE ReadableStream and collect all raw event strings.
 */
async function collectSseEvents(response: Response): Promise<string[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value));
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/prds/[id]/generate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedListener = null;

    // Default: authenticated user
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", role: "AUTHOR" },
    });

    // Default: PRD exists and belongs to a project the user is a member of
    mockPrdFindUnique.mockResolvedValue({
      id: "prd_001",
      title: "A short description for the PRD",
      projectId: "proj_001",
      authorId: "user_1",
      status: "DRAFT",
      generationStatus: "pending",
    });

    mockProjectMemberFindUnique.mockResolvedValue({
      projectId: "proj_001",
      userId: "user_1",
      role: "MEMBER",
    });

    mockPrdUpdate.mockResolvedValue({});

    // AgentSessionManager defaults
    mockCreateSession.mockResolvedValue({ sessionId: mockSessionId });

    mockSubscribe.mockImplementation(
      (_sessionId: string, listener: (event: { type: string; data?: unknown }) => void) => {
        capturedListener = listener;
        return () => {}; // unsubscribe noop
      },
    );

    // prompt resolves immediately; tests fire agent events manually via capturedListener
    mockPrompt.mockResolvedValue(undefined);
    mockDisposeAll.mockResolvedValue(undefined);

    // PrdVersion.findFirst returns null by default (no previous versions)
    mockPrdVersionFindFirst.mockResolvedValue(null);

    // PrdVersion.create returns version 1
    mockPrdVersionCreate.mockResolvedValue({ id: "ver_001", version: 1 });
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/generate") as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // PRD lookup
  // -------------------------------------------------------------------------

  it("returns 404 when PRD not found", async () => {
    mockPrdFindUnique.mockResolvedValue(null);

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_999/generate") as any,
      makeParams("prd_999") as any,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("PRD not found");
  });

  it("returns 403 when user is not a project member", async () => {
    mockProjectMemberFindUnique.mockResolvedValue(null);

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/generate") as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("not a member");
  });

  // -------------------------------------------------------------------------
  // SSE response shape
  // -------------------------------------------------------------------------

  it("returns 200 with SSE content-type header when valid", async () => {
    // Trigger message_end synchronously after prompt resolves so the stream
    // closes and the test can read the response headers without hanging.
    mockPrompt.mockImplementation(async () => {
      if (capturedListener) {
        capturedListener({ type: "message_start" });
        capturedListener({ type: "text_delta", data: "# Generated PRD\n\nContent here." });
        capturedListener({ type: "message_end" });
      }
    });

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/generate") as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("emits session event with sessionId as the first SSE event", async () => {
    mockPrompt.mockImplementation(async () => {
      if (capturedListener) {
        capturedListener({ type: "message_start" });
        capturedListener({ type: "message_end" });
      }
    });

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/generate") as any,
      makeParams("prd_001") as any,
    );

    const chunks = await collectSseEvents(response);
    const raw = chunks.join("");

    expect(raw).toContain(`event: session`);
    expect(raw).toContain(mockSessionId);
  });

  it("emits prd_saved event when generation completes successfully", async () => {
    const prdContent = [
      "# My Generated PRD",
      "",
      "## Summary",
      "This is the summary.",
      "",
      "## Problem Statement",
      "A clearly defined problem.",
      "",
      "## Goals",
      "Goals go here.",
      "",
      "## Requirements",
      "Requirements go here.",
      "",
      "## Non-Functional Requirements",
      "Performance and reliability.",
      "",
      "## Success Metrics",
      "Metrics here.",
    ].join("\n");

    mockPrompt.mockImplementation(async () => {
      if (capturedListener) {
        capturedListener({ type: "message_start" });
        capturedListener({ type: "text_delta", data: prdContent });
        capturedListener({ type: "message_end" });
      }
    });

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/generate") as any,
      makeParams("prd_001") as any,
    );

    const chunks = await collectSseEvents(response);
    const raw = chunks.join("");

    // Verify prd_saved event appears in the stream
    expect(raw).toContain("event: prd_saved");
    expect(raw).toContain('"prdId":"prd_001"');
    expect(raw).toContain('"version":1');

    // Verify PrdVersion was persisted
    expect(mockPrdVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prdId: "prd_001",
          version: 1,
          content: prdContent,
          authorId: "user_1",
        }),
      }),
    );

    // Verify PRD record was updated to completed
    expect(mockPrdUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prd_001" },
        data: expect.objectContaining({
          generationStatus: "completed",
          title: "My Generated PRD",
          currentVersion: 1,
        }),
      }),
    );
  });

  it("emits error event and marks PRD as failed when agent errors", async () => {
    mockPrompt.mockImplementation(async () => {
      if (capturedListener) {
        capturedListener({ type: "message_start" });
        capturedListener({ type: "error", data: "LLM quota exceeded" });
      }
    });

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/generate") as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const chunks = await collectSseEvents(response);
    const raw = chunks.join("");

    expect(raw).toContain("event: error");
    expect(raw).toContain("LLM quota exceeded");

    // Verify the PRD was marked as failed
    expect(mockPrdUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prd_001" },
        data: expect.objectContaining({
          generationStatus: "failed",
          generationError: "LLM quota exceeded",
        }),
      }),
    );
  });

  it("marks PRD as generating before opening the stream", async () => {
    mockPrompt.mockImplementation(async () => {
      if (capturedListener) {
        capturedListener({ type: "message_end" });
      }
    });

    await POST(
      postRequest("http://localhost/api/prds/prd_001/generate") as any,
      makeParams("prd_001") as any,
    );

    // The first update should set generationStatus to "generating"
    expect(mockPrdUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prd_001" },
        data: { generationStatus: "generating" },
      }),
    );
  });

  it("creates the agent session with correct create-mode options", async () => {
    mockPrompt.mockImplementation(async () => {
      if (capturedListener) {
        capturedListener({ type: "message_end" });
      }
    });

    await POST(
      postRequest("http://localhost/api/prds/prd_001/generate") as any,
      makeParams("prd_001") as any,
    );

    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        mode: "create",
        projectId: "proj_001",
        prdId: "prd_001",
        description: "A short description for the PRD",
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Empty content path
  // -------------------------------------------------------------------------

  it("emits error event when agent produces no content", async () => {
    mockPrompt.mockImplementation(async () => {
      if (capturedListener) {
        capturedListener({ type: "message_start" });
        capturedListener({ type: "message_end" }); // no text_delta events
      }
    });

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/generate") as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const chunks = await collectSseEvents(response);
    const raw = chunks.join("");

    // Stream must contain an error event, not a prd_saved event
    expect(raw).toContain("event: error");
    expect(raw).not.toContain("event: prd_saved");

    // PRD must be marked as failed
    expect(mockPrdUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prd_001" },
        data: expect.objectContaining({
          generationStatus: "failed",
        }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Prompt rejection
  // -------------------------------------------------------------------------

  it("emits error event and marks PRD as failed when prompt rejects", async () => {
    mockPrompt.mockRejectedValue(new Error("Connection timeout"));

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/generate") as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const chunks = await collectSseEvents(response);
    const raw = chunks.join("");

    expect(raw).toContain("event: error");
    expect(raw).toContain("Connection timeout");

    expect(mockPrdUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prd_001" },
        data: expect.objectContaining({
          generationStatus: "failed",
          generationError: "Connection timeout",
        }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Idempotency guard
  // -------------------------------------------------------------------------

  it("returns 409 when PRD is already being generated", async () => {
    mockPrdFindUnique.mockResolvedValue({
      id: "prd_001",
      title: "A short description for the PRD",
      projectId: "proj_001",
      authorId: "user_1",
      status: "DRAFT",
      generationStatus: "generating",
    });

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/generate") as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("generating");
  });

  it("returns 409 when PRD generation has already completed", async () => {
    mockPrdFindUnique.mockResolvedValue({
      id: "prd_001",
      title: "A short description for the PRD",
      projectId: "proj_001",
      authorId: "user_1",
      status: "DRAFT",
      generationStatus: "completed",
    });

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/generate") as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("completed");
  });
});
