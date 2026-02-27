/**
 * Session resume API route tests.
 *
 * Tests for POST /api/agent/sessions/[sessionId]/resume.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindSessionFile = jest.fn();
jest.mock("@/services/agent/session-persistence", () => ({
  findSessionFile: (...args: unknown[]) => mockFindSessionFile(...args),
}));

const mockRequireAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/agent/sessions/[sessionId]/resume/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postRequest(url: string): Request {
  return new Request(url, { method: "POST" });
}

function makeContext(sessionId: string) {
  return { params: { sessionId } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/agent/sessions/[sessionId]/resume", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", role: "AUTHOR" },
    });
  });

  it("should return 200 with sessionId when session file exists", async () => {
    mockFindSessionFile.mockResolvedValue(
      "/tmp/prd-agent-sessions/user_1/session_abc.json",
    );

    const response = await POST(
      postRequest("http://localhost/api/agent/sessions/session_abc/resume"),
      makeContext("session_abc"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("sessionId", "session_abc");
  });

  it("should return 404 when session file does not exist", async () => {
    mockFindSessionFile.mockResolvedValue(null);

    const response = await POST(
      postRequest("http://localhost/api/agent/sessions/session_999/resume"),
      makeContext("session_999"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("Session not found");
  });

  it("should return 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/api/errors");
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await POST(
      postRequest("http://localhost/api/agent/sessions/session_abc/resume"),
      makeContext("session_abc"),
    );

    expect(response.status).toBe(401);
  });

  it("should look up session file for the authenticated user", async () => {
    mockFindSessionFile.mockResolvedValue(
      "/tmp/prd-agent-sessions/user_1/session_abc.json",
    );

    await POST(
      postRequest("http://localhost/api/agent/sessions/session_abc/resume"),
      makeContext("session_abc"),
    );

    expect(mockFindSessionFile).toHaveBeenCalledWith("session_abc", "user_1");
  });
});
