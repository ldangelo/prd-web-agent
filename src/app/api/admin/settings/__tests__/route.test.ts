/**
 * Admin Settings API route tests.
 *
 * Tests for GET /api/admin/settings (returns settings)
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

  it("should return settings", async () => {
    mockGlobalSettingsFindUnique.mockResolvedValue(MOCK_SETTINGS);

    const request = createRequest("GET");
    const response = await GET(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.data.llmProvider).toBe("anthropic");
    expect(body.data.llmModel).toBe("claude-sonnet-4-20250514");
    expect(body.data.blockApprovalOnUnresolvedComments).toBe(true);
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
      llmProvider: "openai",
    });

    const request = createRequest("PUT", { llmProvider: "openai" });
    const response = await PUT(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(mockGlobalSettingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "global" },
        update: expect.objectContaining({ llmProvider: "openai" }),
      }),
    );
    expect(body.data.llmProvider).toBe("openai");
  });

  it("should return 403 when not admin", async () => {
    const { ForbiddenError } = jest.requireActual("@/lib/api/errors") as any;
    mockRequireAdmin.mockRejectedValue(new ForbiddenError("Insufficient permissions"));

    const request = createRequest("PUT", { llmProvider: "openai" });
    const response = await PUT(request);

    expect(response.status).toBe(403);
  });

  it("should only accept allowed fields", async () => {
    mockGlobalSettingsUpsert.mockResolvedValue(MOCK_SETTINGS);

    const request = createRequest("PUT", {
      llmProvider: "openai",
      blockApprovalOnUnresolvedComments: false,
    });
    const response = await PUT(request);

    expect(response.status).toBe(200);
    expect(mockGlobalSettingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          llmProvider: "openai",
          blockApprovalOnUnresolvedComments: false,
        },
      }),
    );
  });
});
