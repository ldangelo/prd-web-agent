/**
 * DELETE /api/prds/[id] — unit tests.
 *
 * TDD: tests written before implementation.
 * Covers session authentication, delegation to delete logic, and error handling.
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockPrdFindFirst = jest.fn();
const mockPrdUpdate = jest.fn();
const mockAuditEntryCreate = jest.fn();
const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findFirst: (...args: unknown[]) => mockPrdFindFirst(...args),
      update: (...args: unknown[]) => mockPrdUpdate(...args),
    },
    auditEntry: {
      create: (...args: unknown[]) => mockAuditEntryCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const mockDeletePrdIndex = jest.fn();

jest.mock("@/services/search-service", () => ({
  SearchService: jest.fn().mockImplementation(() => ({
    deletePrdIndex: (...args: unknown[]) => mockDeletePrdIndex(...args),
  })),
}));

const mockRemoveClone = jest.fn();

jest.mock("@/lib/repo-clone-service", () => ({
  repoCloneService: {
    removeClone: (...args: unknown[]) => mockRemoveClone(...args),
  },
}));

const mockRequireAuth = jest.fn();

jest.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { DELETE } from "../route";
import { UnauthorizedError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function deleteRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/prds/${id}`, {
    method: "DELETE",
  });
}

const MOCK_PRD = {
  id: "prd_001",
  title: "My Draft PRD",
  authorId: "user_001",
  projectId: "proj_001",
  status: "DRAFT",
  isDeleted: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DELETE /api/prds/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user: { id: "user_001", email: "test@example.com", role: "AUTHOR" },
    });

    // Default: transaction executes the callback
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        prd: { update: mockPrdUpdate },
        auditEntry: { create: mockAuditEntryCreate },
      };
      return fn(tx);
    });

    mockPrdFindFirst.mockResolvedValue(MOCK_PRD);
    mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD, isDeleted: true });
    mockAuditEntryCreate.mockResolvedValue({});
    mockDeletePrdIndex.mockResolvedValue(undefined);
    mockRemoveClone.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await DELETE(
      deleteRequest("prd_001"),
      makeParams("prd_001") as any,
    );
    expect(response.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Business Rules (delegated to shared delete logic)
  // -------------------------------------------------------------------------

  it("should return 404 when PRD does not exist", async () => {
    mockPrdFindFirst.mockResolvedValue(null);

    const response = await DELETE(
      deleteRequest("prd_999"),
      makeParams("prd_999") as any,
    );
    expect(response.status).toBe(404);
  });

  it("should return 403 when user is not the author", async () => {
    mockPrdFindFirst.mockResolvedValue({ ...MOCK_PRD, authorId: "other_user" });

    const response = await DELETE(
      deleteRequest("prd_001"),
      makeParams("prd_001") as any,
    );
    expect(response.status).toBe(403);
  });

  it("should return 409 when PRD is not in DRAFT status", async () => {
    mockPrdFindFirst.mockResolvedValue({ ...MOCK_PRD, status: "APPROVED" });

    const response = await DELETE(
      deleteRequest("prd_001"),
      makeParams("prd_001") as any,
    );
    expect(response.status).toBe(409);
  });

  // -------------------------------------------------------------------------
  // Success Path
  // -------------------------------------------------------------------------

  it("should soft-delete a DRAFT PRD owned by the authenticated user", async () => {
    const response = await DELETE(
      deleteRequest("prd_001"),
      makeParams("prd_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ deleted: true, identifier: "prd_001" });
  });

  it("should call the transaction to soft-delete the PRD", async () => {
    await DELETE(
      deleteRequest("prd_001"),
      makeParams("prd_001") as any,
    );

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockPrdUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prd_001" },
        data: expect.objectContaining({
          isDeleted: true,
          deletedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("should create an audit entry on successful deletion", async () => {
    await DELETE(
      deleteRequest("prd_001"),
      makeParams("prd_001") as any,
    );

    expect(mockAuditEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "prd.deleted",
          prdId: "prd_001",
          userId: "user_001",
        }),
      }),
    );
  });

  it("should still return 200 if search index cleanup fails", async () => {
    mockDeletePrdIndex.mockRejectedValue(new Error("Search unavailable"));

    const response = await DELETE(
      deleteRequest("prd_001"),
      makeParams("prd_001") as any,
    );
    expect(response.status).toBe(200);
  });
});
