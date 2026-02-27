/**
 * Agent sessions API route tests.
 *
 * Tests for GET /api/agent/sessions - listing active sessions for the current user.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockListUserSessions = jest.fn();
jest.mock("@/services/agent/session-persistence", () => ({
  listUserSessions: (...args: unknown[]) => mockListUserSessions(...args),
}));

const mockRequireAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { GET } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRequest(): Request {
  return new Request("http://localhost/api/agent/sessions");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/agent/sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", role: "AUTHOR" },
    });
  });

  it("should return user's active sessions", async () => {
    mockListUserSessions.mockResolvedValue([
      {
        sessionId: "session_abc",
        filePath: "/tmp/prd-agent-sessions/user_1/session_abc.json",
        createdAt: new Date("2026-02-26T10:00:00.000Z"),
        sizeBytes: 4096,
      },
      {
        sessionId: "session_def",
        filePath: "/tmp/prd-agent-sessions/user_1/session_def.json",
        createdAt: new Date("2026-02-25T08:00:00.000Z"),
        sizeBytes: 2048,
      },
    ]);

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("sessions");
    expect(body.data.sessions).toHaveLength(2);
    expect(body.data.sessions[0]).toHaveProperty("sessionId", "session_abc");
    expect(body.data.sessions[0]).toHaveProperty("lastActivity");
  });

  it("should return empty array when no sessions exist", async () => {
    mockListUserSessions.mockResolvedValue([]);

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.sessions).toEqual([]);
  });

  it("should return 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/api/errors");
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
  });

  it("should call listUserSessions with the authenticated user ID", async () => {
    mockListUserSessions.mockResolvedValue([]);

    await GET(getRequest());

    expect(mockListUserSessions).toHaveBeenCalledWith("user_1");
  });
});
