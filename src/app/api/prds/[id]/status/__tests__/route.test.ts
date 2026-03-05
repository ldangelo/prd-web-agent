/**
 * Status API route tests.
 *
 * Tests for POST /api/prds/[id]/status.
 * Uses mocked auth and StatusWorkflowService.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockRequireAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

const mockPrdFindUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: { findUnique: (...args: unknown[]) => mockPrdFindUnique(...args) },
  },
}));

const mockEnsureRepoClone = jest.fn();
jest.mock("@/app/api/internal/repo/_lib/ensure-clone", () => ({
  ensureRepoClone: (...args: unknown[]) => mockEnsureRepoClone(...args),
}));

const mockTransition = jest.fn();
const mockGetValidTransitions = jest.fn();
jest.mock("@/services/status-workflow-service", () => ({
  StatusWorkflowService: jest.fn().mockImplementation(() => ({
    transition: (...args: unknown[]) => mockTransition(...args),
    getValidTransitions: (...args: unknown[]) => mockGetValidTransitions(...args),
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

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/prds/prd_001/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/prds/[id]/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user: { id: "user_author", email: "author@example.com", role: "AUTHOR" },
    });

    mockPrdFindUnique.mockResolvedValue({ projectId: "proj_001" });
    mockEnsureRepoClone.mockResolvedValue({ cloneDir: "/repos/user_author/proj_001" });
    mockTransition.mockResolvedValue(undefined);
  });

  it("should transition status and return 200", async () => {
    const response = await POST(
      postRequest({ to: "IN_REVIEW" }) as any,
      makeParams("prd_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("status", "IN_REVIEW");
    expect(mockTransition).toHaveBeenCalledWith(
      "prd_001",
      "user_author",
      "IN_REVIEW",
      undefined,
    );
  });

  it("should pass comment to transition service", async () => {
    const response = await POST(
      postRequest({ to: "DRAFT", comment: "Needs revision" }) as any,
      makeParams("prd_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockTransition).toHaveBeenCalledWith(
      "prd_001",
      "user_author",
      "DRAFT",
      "Needs revision",
    );
  });

  it("should return error when repo clone fails on IN_REVIEW transition", async () => {
    mockEnsureRepoClone.mockResolvedValue(
      new Response(JSON.stringify({ error: "No GitHub OAuth token available" }), { status: 401 }),
    );

    const response = await POST(
      postRequest({ to: "IN_REVIEW" }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(401);
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it("should return error when transition is invalid", async () => {
    const { ApiError } = await import("@/lib/api/errors");
    mockTransition.mockRejectedValue(
      new ApiError("Invalid status transition from DRAFT to APPROVED", 422),
    );

    const response = await POST(
      postRequest({ to: "APPROVED" }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(422);
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await POST(
      postRequest({ to: "IN_REVIEW" }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(401);
  });

  it("should return 422 when 'to' field is missing", async () => {
    const response = await POST(
      postRequest({}) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(422);
  });

  it("should return 422 when 'to' is not a valid status", async () => {
    const response = await POST(
      postRequest({ to: "INVALID_STATUS" }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(422);
  });
});
