/**
 * Co-authors API route tests.
 *
 * Tests for POST /api/prds/[id]/co-authors (add co-author)
 * and DELETE /api/prds/[id]/co-authors/[userId] (remove co-author).
 * Uses mocked Prisma client and auth session.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockPrdFindUnique = jest.fn();
const mockPrdCoAuthorFindUnique = jest.fn();
const mockPrdCoAuthorCreate = jest.fn();
const mockPrdCoAuthorDelete = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findUnique: (...args: unknown[]) => mockPrdFindUnique(...args),
    },
    prdCoAuthor: {
      findUnique: (...args: unknown[]) => mockPrdCoAuthorFindUnique(...args),
      create: (...args: unknown[]) => mockPrdCoAuthorCreate(...args),
      delete: (...args: unknown[]) => mockPrdCoAuthorDelete(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

const mockRequireAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from "../route";
import { DELETE } from "../[userId]/route";
import { UnauthorizedError, ForbiddenError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeDeleteParams(id: string, userId: string) {
  return { params: Promise.resolve({ id, userId }) };
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/prds/prd_001/co-authors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_PRD = {
  id: "prd_001",
  title: "Test PRD",
  authorId: "user_author",
  projectId: "proj_001",
};

// ---------------------------------------------------------------------------
// Tests: POST /api/prds/[id]/co-authors
// ---------------------------------------------------------------------------

describe("POST /api/prds/[id]/co-authors", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated as author
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_author", email: "author@example.com", role: "AUTHOR" },
    });

    // Default: PRD exists
    mockPrdFindUnique.mockResolvedValue(MOCK_PRD);

    // Default: user exists
    mockUserFindUnique.mockResolvedValue({
      id: "user_new",
      name: "New User",
      email: "new@example.com",
    });

    // Default: not already a co-author
    mockPrdCoAuthorFindUnique.mockResolvedValue(null);

    // Default: create succeeds
    mockPrdCoAuthorCreate.mockResolvedValue({
      id: "ca_new",
      prdId: "prd_001",
      userId: "user_new",
      user: { id: "user_new", name: "New User", email: "new@example.com" },
    });
  });

  it("should add a co-author and return 201", async () => {
    const response = await POST(
      postRequest({ userId: "user_new" }) as any,
      makeParams("prd_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("userId", "user_new");
  });

  it("should allow admin to add co-author", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", role: "ADMIN" },
    });

    const response = await POST(
      postRequest({ userId: "user_new" }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(201);
  });

  it("should reject duplicates with 409", async () => {
    mockPrdCoAuthorFindUnique.mockResolvedValue({
      id: "ca_existing",
      prdId: "prd_001",
      userId: "user_new",
    });

    const response = await POST(
      postRequest({ userId: "user_new" }) as any,
      makeParams("prd_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("already a co-author");
  });

  it("should reject non-author non-admin users with 403", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: "user_random",
        email: "random@example.com",
        role: "AUTHOR",
      },
    });

    const response = await POST(
      postRequest({ userId: "user_new" }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(403);
  });

  it("should return 404 when PRD does not exist", async () => {
    mockPrdFindUnique.mockResolvedValue(null);

    const response = await POST(
      postRequest({ userId: "user_new" }) as any,
      makeParams("prd_999") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 404 when user does not exist", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const response = await POST(
      postRequest({ userId: "user_nonexistent" }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 422 when userId is missing", async () => {
    const response = await POST(
      postRequest({}) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(422);
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await POST(
      postRequest({ userId: "user_new" }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests: DELETE /api/prds/[id]/co-authors/[userId]
// ---------------------------------------------------------------------------

describe("DELETE /api/prds/[id]/co-authors/[userId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated as author
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_author", email: "author@example.com", role: "AUTHOR" },
    });

    // Default: PRD exists
    mockPrdFindUnique.mockResolvedValue(MOCK_PRD);

    // Default: co-author exists
    mockPrdCoAuthorFindUnique.mockResolvedValue({
      id: "ca_1",
      prdId: "prd_001",
      userId: "user_coauthor",
    });

    // Default: delete succeeds
    mockPrdCoAuthorDelete.mockResolvedValue({
      id: "ca_1",
      prdId: "prd_001",
      userId: "user_coauthor",
    });
  });

  it("should remove a co-author and return 200", async () => {
    const response = await DELETE(
      new Request(
        "http://localhost/api/prds/prd_001/co-authors/user_coauthor",
        { method: "DELETE" },
      ) as any,
      makeDeleteParams("prd_001", "user_coauthor") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("deleted", true);
  });

  it("should allow admin to remove co-author", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", role: "ADMIN" },
    });

    const response = await DELETE(
      new Request(
        "http://localhost/api/prds/prd_001/co-authors/user_coauthor",
        { method: "DELETE" },
      ) as any,
      makeDeleteParams("prd_001", "user_coauthor") as any,
    );

    expect(response.status).toBe(200);
  });

  it("should return 404 when co-author relationship does not exist", async () => {
    mockPrdCoAuthorFindUnique.mockResolvedValue(null);

    const response = await DELETE(
      new Request(
        "http://localhost/api/prds/prd_001/co-authors/user_nobody",
        { method: "DELETE" },
      ) as any,
      makeDeleteParams("prd_001", "user_nobody") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 403 for non-author non-admin", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: "user_random",
        email: "random@example.com",
        role: "AUTHOR",
      },
    });

    const response = await DELETE(
      new Request(
        "http://localhost/api/prds/prd_001/co-authors/user_coauthor",
        { method: "DELETE" },
      ) as any,
      makeDeleteParams("prd_001", "user_coauthor") as any,
    );

    expect(response.status).toBe(403);
  });

  it("should return 404 when PRD does not exist", async () => {
    mockPrdFindUnique.mockResolvedValue(null);

    const response = await DELETE(
      new Request(
        "http://localhost/api/prds/prd_999/co-authors/user_coauthor",
        { method: "DELETE" },
      ) as any,
      makeDeleteParams("prd_999", "user_coauthor") as any,
    );

    expect(response.status).toBe(404);
  });
});
