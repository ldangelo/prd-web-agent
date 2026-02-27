/**
 * Tags API route tests.
 *
 * Tests for PUT /api/prds/[id]/tags - updating tags on a PRD.
 * Uses mocked Prisma client and auth session.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockPrdFindUnique = jest.fn();
const mockPrdUpdate = jest.fn();
const mockPrdCoAuthorFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findUnique: (...args: unknown[]) => mockPrdFindUnique(...args),
      update: (...args: unknown[]) => mockPrdUpdate(...args),
    },
    prdCoAuthor: {
      findUnique: (...args: unknown[]) => mockPrdCoAuthorFindUnique(...args),
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

import { PUT } from "../route";
import { UnauthorizedError, ForbiddenError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function putRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/prds/prd_001/tags", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_PRD = {
  id: "prd_001",
  title: "Test PRD",
  authorId: "user_author",
  projectId: "proj_001",
  tags: ["existing-tag"],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PUT /api/prds/[id]/tags", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated as author
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_author", email: "author@example.com", role: "AUTHOR" },
    });

    // Default: PRD exists
    mockPrdFindUnique.mockResolvedValue(MOCK_PRD);

    // Default: not a co-author (will be author)
    mockPrdCoAuthorFindUnique.mockResolvedValue(null);

    // Default: update succeeds
    mockPrdUpdate.mockResolvedValue({
      ...MOCK_PRD,
      tags: ["new-tag"],
    });
  });

  it("should update tags successfully", async () => {
    const response = await PUT(
      putRequest({ tags: ["new-tag", "another-tag"] }) as any,
      makeParams("prd_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("data");
    expect(mockPrdUpdate).toHaveBeenCalledWith({
      where: { id: "prd_001" },
      data: { tags: ["new-tag", "another-tag"] },
    });
  });

  it("should allow co-authors to update tags", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: "user_coauthor",
        email: "coauthor@example.com",
        role: "AUTHOR",
      },
    });
    mockPrdCoAuthorFindUnique.mockResolvedValue({
      id: "ca_1",
      prdId: "prd_001",
      userId: "user_coauthor",
    });

    const response = await PUT(
      putRequest({ tags: ["co-tag"] }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(200);
  });

  it("should allow admins to update tags", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", role: "ADMIN" },
    });

    const response = await PUT(
      putRequest({ tags: ["admin-tag"] }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(200);
  });

  it("should validate max 10 tags", async () => {
    const tooManyTags = Array.from({ length: 11 }, (_, i) => `tag-${i}`);

    const response = await PUT(
      putRequest({ tags: tooManyTags }) as any,
      makeParams("prd_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toHaveProperty("error");
  });

  it("should validate tags are non-empty strings", async () => {
    const response = await PUT(
      putRequest({ tags: ["valid", ""] }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(422);
  });

  it("should reject unauthorized users", async () => {
    mockRequireAuth.mockResolvedValue({
      user: {
        id: "user_random",
        email: "random@example.com",
        role: "AUTHOR",
      },
    });
    // Not author, not co-author, not admin
    mockPrdCoAuthorFindUnique.mockResolvedValue(null);

    const response = await PUT(
      putRequest({ tags: ["tag"] }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(403);
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await PUT(
      putRequest({ tags: ["tag"] }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(401);
  });

  it("should return 404 when PRD does not exist", async () => {
    mockPrdFindUnique.mockResolvedValue(null);

    const response = await PUT(
      putRequest({ tags: ["tag"] }) as any,
      makeParams("prd_999") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should allow setting empty tags array", async () => {
    mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD, tags: [] });

    const response = await PUT(
      putRequest({ tags: [] }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(200);
    expect(mockPrdUpdate).toHaveBeenCalledWith({
      where: { id: "prd_001" },
      data: { tags: [] },
    });
  });
});
