/**
 * DELETE /api/internal/prd/delete — unit tests.
 *
 * TDD: tests written before implementation.
 * Tests cover auth, validation, business rules, success path, and failure modes.
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

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { DELETE } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TOKEN = "test-internal-token";

function makeRequest(
  body: unknown,
  token?: string,
): NextRequest {
  return new NextRequest("http://localhost/api/internal/prd/delete", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const MOCK_PRD = {
  id: "prd_001",
  title: "My Draft PRD",
  authorId: "user_001",
  status: "DRAFT",
  isDeleted: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DELETE /api/internal/prd/delete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENCLAW_INTERNAL_TOKEN = VALID_TOKEN;

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
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it("should return 401 when Authorization header is missing", async () => {
    const req = makeRequest(
      { identifier: "prd_001", userId: "user_001" },
      undefined,
    );
    // Remove Authorization header entirely
    const reqNoAuth = new NextRequest(
      "http://localhost/api/internal/prd/delete",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: "prd_001", userId: "user_001" }),
      },
    );
    const response = await DELETE(reqNoAuth);
    expect(response.status).toBe(401);
  });

  it("should return 401 when token is invalid", async () => {
    const req = makeRequest(
      { identifier: "prd_001", userId: "user_001" },
      "wrong-token",
    );
    const response = await DELETE(req);
    expect(response.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it("should return 400 when body is missing identifier", async () => {
    const req = makeRequest({ userId: "user_001" }, VALID_TOKEN);
    const response = await DELETE(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("should return 400 when body is missing userId", async () => {
    const req = makeRequest({ identifier: "prd_001" }, VALID_TOKEN);
    const response = await DELETE(req);
    expect(response.status).toBe(400);
  });

  it("should return 400 when identifier is empty string", async () => {
    const req = makeRequest({ identifier: "", userId: "user_001" }, VALID_TOKEN);
    const response = await DELETE(req);
    expect(response.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Business Rules
  // -------------------------------------------------------------------------

  it("should return 404 when PRD is not found", async () => {
    mockPrdFindFirst.mockResolvedValue(null);
    const req = makeRequest(
      { identifier: "prd_999", userId: "user_001" },
      VALID_TOKEN,
    );
    const response = await DELETE(req);
    expect(response.status).toBe(404);
  });

  it("should return 404 when PRD is already soft-deleted", async () => {
    mockPrdFindFirst.mockResolvedValue(null); // isDeleted: false filter means null is returned
    const req = makeRequest(
      { identifier: "prd_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const response = await DELETE(req);
    expect(response.status).toBe(404);
  });

  it("should return 403 when user is not the PRD author", async () => {
    mockPrdFindFirst.mockResolvedValue({ ...MOCK_PRD, authorId: "other_user" });
    const req = makeRequest(
      { identifier: "prd_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const response = await DELETE(req);
    expect(response.status).toBe(403);
  });

  it("should return 409 when PRD status is not DRAFT", async () => {
    mockPrdFindFirst.mockResolvedValue({ ...MOCK_PRD, status: "IN_REVIEW" });
    const req = makeRequest(
      { identifier: "prd_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const response = await DELETE(req);
    expect(response.status).toBe(409);
  });

  it("should return 409 when PRD status is APPROVED", async () => {
    mockPrdFindFirst.mockResolvedValue({ ...MOCK_PRD, status: "APPROVED" });
    const req = makeRequest(
      { identifier: "prd_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const response = await DELETE(req);
    expect(response.status).toBe(409);
  });

  // -------------------------------------------------------------------------
  // Success Path
  // -------------------------------------------------------------------------

  it("should soft-delete PRD and return 200 with { deleted: true, identifier }", async () => {
    const req = makeRequest(
      { identifier: "prd_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const response = await DELETE(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ deleted: true, identifier: "prd_001" });
  });

  it("should perform soft-delete via transaction (set isDeleted=true, deletedAt)", async () => {
    const req = makeRequest(
      { identifier: "prd_001", userId: "user_001" },
      VALID_TOKEN,
    );
    await DELETE(req);

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

  it("should create an audit entry inside the transaction", async () => {
    const req = makeRequest(
      { identifier: "prd_001", userId: "user_001" },
      VALID_TOKEN,
    );
    await DELETE(req);

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

  it("should call searchService.deletePrdIndex after the transaction (non-blocking)", async () => {
    const req = makeRequest(
      { identifier: "prd_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const response = await DELETE(req);

    expect(response.status).toBe(200);
    expect(mockDeletePrdIndex).toHaveBeenCalledWith("prd_001");
  });

  it("should still return 200 if searchService.deletePrdIndex throws (non-blocking)", async () => {
    mockDeletePrdIndex.mockRejectedValue(new Error("Search index unavailable"));

    const req = makeRequest(
      { identifier: "prd_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const response = await DELETE(req);
    expect(response.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Transaction Failure / Rollback
  // -------------------------------------------------------------------------

  it("should return 500 and not call search if transaction fails", async () => {
    mockTransaction.mockRejectedValue(new Error("DB connection failed"));

    const req = makeRequest(
      { identifier: "prd_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const response = await DELETE(req);

    expect(response.status).toBe(500);
    expect(mockDeletePrdIndex).not.toHaveBeenCalled();
  });
});
