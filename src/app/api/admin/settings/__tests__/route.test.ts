/**
 * Admin Settings API route tests.
 *
 * Tests for GET /api/admin/settings (returns settings with tokens redacted)
 * and PUT /api/admin/settings (admin-only update).
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockGlobalSettingsFindUnique = jest.fn();
const mockGlobalSettingsUpsert = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    globalSettings: {
      findUnique: (...args: unknown[]) => mockGlobalSettingsFindUnique(...args),
      upsert: (...args: unknown[]) => mockGlobalSettingsUpsert(...args),
    },
  },
}));

const mockRequireAuth = jest.fn();
const mockRequireAdmin = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { GET, PUT } from "../route";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_SETTINGS = {
  id: "global",
  confluenceSpace: "SPACE",
  jiraProject: "PROJ",
  gitRepo: "org/repo",
  beadsProject: "beads-proj",
  confluenceToken: "secret-token-1",
  jiraToken: "secret-token-2",
  gitToken: "secret-token-3",
  llmProvider: "anthropic",
  llmModel: "claude-sonnet-4-20250514",
  llmThinkingLevel: "medium",
  blockApprovalOnUnresolvedComments: true,
  updatedAt: new Date("2026-01-01"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  method: string,
  body?: Record<string, unknown>,
): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest("http://localhost:3000/api/admin/settings", init);
}

async function parseResponse(response: Response) {
  return response.json();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/admin/settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_admin", role: "ADMIN" },
    });
  });

  it("should return settings with tokens redacted", async () => {
    mockGlobalSettingsFindUnique.mockResolvedValue(MOCK_SETTINGS);

    const request = createRequest("GET");
    const response = await GET(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.data.confluenceSpace).toBe("SPACE");
    expect(body.data.confluenceToken).toBe("••••••••");
    expect(body.data.jiraToken).toBe("••••••••");
    expect(body.data.gitToken).toBe("••••••••");
  });

  it("should return empty object when no settings exist", async () => {
    mockGlobalSettingsFindUnique.mockResolvedValue(null);

    const request = createRequest("GET");
    const response = await GET(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.data).toBeNull();
  });

  it("should return 401 when not authenticated", async () => {
    const { UnauthorizedError } = jest.requireActual("@/lib/api/errors") as any;
    mockRequireAuth.mockRejectedValue(new UnauthorizedError("Authentication required"));

    const request = createRequest("GET");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});

describe("PUT /api/admin/settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({
      user: { id: "user_admin", role: "ADMIN" },
    });
  });

  it("should update settings (admin only)", async () => {
    mockGlobalSettingsUpsert.mockResolvedValue({
      ...MOCK_SETTINGS,
      confluenceSpace: "NEW_SPACE",
    });

    const request = createRequest("PUT", { confluenceSpace: "NEW_SPACE" });
    const response = await PUT(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(mockGlobalSettingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "global" },
        update: expect.objectContaining({ confluenceSpace: "NEW_SPACE" }),
      }),
    );
    // Tokens in response should be redacted
    expect(body.data.confluenceToken).toBe("••••••••");
  });

  it("should return 403 when not admin", async () => {
    const { ForbiddenError } = jest.requireActual("@/lib/api/errors") as any;
    mockRequireAdmin.mockRejectedValue(new ForbiddenError("Insufficient permissions"));

    const request = createRequest("PUT", { confluenceSpace: "NEW_SPACE" });
    const response = await PUT(request);

    expect(response.status).toBe(403);
  });

  it("should allow updating tokens", async () => {
    mockGlobalSettingsUpsert.mockResolvedValue({
      ...MOCK_SETTINGS,
      confluenceToken: "new-secret-token",
    });

    const request = createRequest("PUT", {
      confluenceToken: "new-secret-token",
    });
    const response = await PUT(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    // Even new tokens are redacted in response
    expect(body.data.confluenceToken).toBe("••••••••");
  });
});
