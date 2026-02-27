/**
 * Audit API route tests.
 *
 * Tests for GET /api/prds/[id]/audit.
 * Uses mocked auth and AuditService.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockRequireAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

const mockGetAuditTrail = jest.fn();
jest.mock("@/services/audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    getAuditTrail: (...args: unknown[]) => mockGetAuditTrail(...args),
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET } from "../route";
import { UnauthorizedError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/prds/[id]/audit", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user: { id: "user_author", email: "author@example.com", role: "AUTHOR" },
    });
  });

  it("should return audit trail for a PRD", async () => {
    const entries = [
      {
        id: "audit_001",
        prdId: "prd_001",
        userId: "user_001",
        action: "STATUS_CHANGE",
        fromStatus: "DRAFT",
        toStatus: "IN_REVIEW",
        detail: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        user: { id: "user_001", name: "Author", email: "author@example.com" },
      },
    ];
    mockGetAuditTrail.mockResolvedValue(entries);

    const response = await GET(
      new Request("http://localhost/api/prds/prd_001/audit") as any,
      makeParams("prd_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(entries);
    expect(mockGetAuditTrail).toHaveBeenCalledWith("prd_001");
  });

  it("should return empty array when no audit entries exist", async () => {
    mockGetAuditTrail.mockResolvedValue([]);

    const response = await GET(
      new Request("http://localhost/api/prds/prd_empty/audit") as any,
      makeParams("prd_empty") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await GET(
      new Request("http://localhost/api/prds/prd_001/audit") as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(401);
  });
});
