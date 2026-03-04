/**
 * PRD Delete Service tests.
 *
 * Covers all business rules for soft-deleting a PRD, including:
 * - 404 when PRD not found or already deleted
 * - 403 when caller is not the author
 * - 409 when PRD is not in DRAFT status
 * - Successful soft-delete with transaction, search cleanup, and repo cleanup
 * - Non-fatal handling of search index and repo clone cleanup failures
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

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { deletePrd } from "../prd-delete-service";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MOCK_PRD = {
  id: "prd_001",
  title: "My Draft PRD",
  authorId: "user_001",
  projectId: "proj_001",
  status: "DRAFT",
  isDeleted: false,
};

const USER_ID = "user_001";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deletePrd", () => {
  beforeEach(() => {
    jest.clearAllMocks();

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
  // 404 — PRD not found
  // -------------------------------------------------------------------------

  it("returns 404 when PRD does not exist", async () => {
    mockPrdFindFirst.mockResolvedValue(null);

    const result = await deletePrd("prd_999", USER_ID);

    expect(result.deleted).toBe(false);
    expect(result.errorResponse).not.toBeNull();
    expect(result.errorResponse!.status).toBe(404);
  });

  it("returns 404 when PRD is already soft-deleted (isDeleted filter)", async () => {
    // Simulate Prisma returning null because isDeleted: false filter excludes it
    mockPrdFindFirst.mockResolvedValue(null);

    const result = await deletePrd("prd_001", USER_ID);

    expect(result.deleted).toBe(false);
    expect(result.errorResponse!.status).toBe(404);
    // Verify the query filtered on isDeleted: false
    expect(mockPrdFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isDeleted: false }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 403 — Authorisation
  // -------------------------------------------------------------------------

  it("returns 403 when caller is not the author", async () => {
    mockPrdFindFirst.mockResolvedValue({
      ...MOCK_PRD,
      authorId: "different_user",
    });

    const result = await deletePrd("prd_001", USER_ID);

    expect(result.deleted).toBe(false);
    expect(result.errorResponse!.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // 409 — Status guard
  // -------------------------------------------------------------------------

  it("returns 409 when PRD is in APPROVED status", async () => {
    mockPrdFindFirst.mockResolvedValue({ ...MOCK_PRD, status: "APPROVED" });

    const result = await deletePrd("prd_001", USER_ID);

    expect(result.deleted).toBe(false);
    expect(result.errorResponse!.status).toBe(409);
  });

  it("returns 409 when PRD is in SUBMITTED status", async () => {
    mockPrdFindFirst.mockResolvedValue({ ...MOCK_PRD, status: "SUBMITTED" });

    const result = await deletePrd("prd_001", USER_ID);

    expect(result.deleted).toBe(false);
    expect(result.errorResponse!.status).toBe(409);
  });

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------

  it("returns deleted:true with no errorResponse on success", async () => {
    const result = await deletePrd("prd_001", USER_ID);

    expect(result.deleted).toBe(true);
    expect(result.errorResponse).toBeNull();
  });

  it("calls transaction to soft-delete the PRD record", async () => {
    await deletePrd("prd_001", USER_ID);

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

  it("creates an audit entry inside the transaction", async () => {
    await deletePrd("prd_001", USER_ID);

    expect(mockAuditEntryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "prd.deleted",
          prdId: "prd_001",
          userId: USER_ID,
        }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Repo clone cleanup
  // -------------------------------------------------------------------------

  it("calls removeClone with userId and projectId from the PRD after deletion", async () => {
    await deletePrd("prd_001", USER_ID);

    expect(mockRemoveClone).toHaveBeenCalledTimes(1);
    expect(mockRemoveClone).toHaveBeenCalledWith(USER_ID, MOCK_PRD.projectId);
  });

  it("still returns deleted:true when removeClone throws", async () => {
    mockRemoveClone.mockRejectedValue(new Error("EFS unavailable"));

    const result = await deletePrd("prd_001", USER_ID);

    expect(result.deleted).toBe(true);
    expect(result.errorResponse).toBeNull();
  });

  it("does NOT call removeClone when PRD is not found", async () => {
    mockPrdFindFirst.mockResolvedValue(null);

    await deletePrd("prd_999", USER_ID);

    expect(mockRemoveClone).not.toHaveBeenCalled();
  });

  it("does NOT call removeClone when authorisation fails", async () => {
    mockPrdFindFirst.mockResolvedValue({
      ...MOCK_PRD,
      authorId: "other_user",
    });

    await deletePrd("prd_001", USER_ID);

    expect(mockRemoveClone).not.toHaveBeenCalled();
  });

  it("does NOT call removeClone when status check fails", async () => {
    mockPrdFindFirst.mockResolvedValue({ ...MOCK_PRD, status: "APPROVED" });

    await deletePrd("prd_001", USER_ID);

    expect(mockRemoveClone).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Search index cleanup
  // -------------------------------------------------------------------------

  it("still returns deleted:true when search index cleanup fails", async () => {
    mockDeletePrdIndex.mockRejectedValue(new Error("OpenSearch down"));

    const result = await deletePrd("prd_001", USER_ID);

    expect(result.deleted).toBe(true);
    expect(result.errorResponse).toBeNull();
  });
});
