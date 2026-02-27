/**
 * PRD listing API route tests.
 *
 * Tests for GET /api/prds - listing PRDs with filtering, sorting, and pagination.
 * Uses mocked Prisma client and auth session.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockPrdFindMany = jest.fn();
const mockPrdCount = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findMany: (...args: unknown[]) => mockPrdFindMany(...args),
      count: (...args: unknown[]) => mockPrdCount(...args),
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

import { GET } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/prds");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString(), { method: "GET" });
}

const MOCK_PRD_LIST = [
  {
    id: "prd_001",
    title: "User Authentication Flow",
    status: "DRAFT",
    tags: ["auth", "security"],
    currentVersion: 1,
    updatedAt: new Date("2026-02-24T16:00:00.000Z"),
    createdAt: new Date("2026-02-10T08:00:00.000Z"),
    project: { id: "proj_001", name: "Project Alpha" },
    author: { id: "user_1", name: "Alice" },
  },
  {
    id: "prd_002",
    title: "Shopping Cart Experience",
    status: "IN_REVIEW",
    tags: ["ecommerce"],
    currentVersion: 2,
    updatedAt: new Date("2026-02-25T09:30:00.000Z"),
    createdAt: new Date("2026-02-12T10:00:00.000Z"),
    project: { id: "proj_001", name: "Project Alpha" },
    author: { id: "user_2", name: "Bob" },
  },
  {
    id: "prd_003",
    title: "Dashboard Analytics Module",
    status: "APPROVED",
    tags: ["analytics"],
    currentVersion: 3,
    updatedAt: new Date("2026-02-26T08:00:00.000Z"),
    createdAt: new Date("2026-02-15T11:00:00.000Z"),
    project: { id: "proj_002", name: "Project Beta" },
    author: { id: "user_1", name: "Alice" },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/prds", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", role: "AUTHOR" },
    });

    mockPrdFindMany.mockResolvedValue(MOCK_PRD_LIST);
    mockPrdCount.mockResolvedValue(3);
  });

  it("should return paginated PRD list with default pagination", async () => {
    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("items");
    expect(body.data).toHaveProperty("pagination");
    expect(body.data.items).toHaveLength(3);
    expect(body.data.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });
  });

  it("should include project name, author name, and all PRD fields", async () => {
    const response = await GET(getRequest() as any);
    const body = await response.json();

    const firstItem = body.data.items[0];
    expect(firstItem).toHaveProperty("id", "prd_001");
    expect(firstItem).toHaveProperty("title", "User Authentication Flow");
    expect(firstItem).toHaveProperty("status", "DRAFT");
    expect(firstItem).toHaveProperty("tags");
    expect(firstItem).toHaveProperty("currentVersion", 1);
    expect(firstItem).toHaveProperty("project");
    expect(firstItem.project).toHaveProperty("name", "Project Alpha");
    expect(firstItem).toHaveProperty("author");
    expect(firstItem.author).toHaveProperty("name", "Alice");
  });

  it("should call prisma with include for project and author", async () => {
    await GET(getRequest() as any);

    expect(mockPrdFindMany).toHaveBeenCalledTimes(1);
    const findManyArgs = mockPrdFindMany.mock.calls[0][0];
    expect(findManyArgs.include).toEqual({
      project: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    });
  });

  it("should filter by status query parameter", async () => {
    mockPrdFindMany.mockResolvedValue([MOCK_PRD_LIST[0]]);
    mockPrdCount.mockResolvedValue(1);

    const response = await GET(getRequest({ status: "DRAFT" }) as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toHaveLength(1);

    const findManyArgs = mockPrdFindMany.mock.calls[0][0];
    expect(findManyArgs.where).toHaveProperty("status", "DRAFT");
  });

  it("should filter by project query parameter", async () => {
    mockPrdFindMany.mockResolvedValue([MOCK_PRD_LIST[2]]);
    mockPrdCount.mockResolvedValue(1);

    const response = await GET(getRequest({ project: "proj_002" }) as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toHaveLength(1);

    const findManyArgs = mockPrdFindMany.mock.calls[0][0];
    expect(findManyArgs.where).toHaveProperty("projectId", "proj_002");
  });

  it("should filter by author query parameter", async () => {
    await GET(getRequest({ author: "user_2" }) as any);

    const findManyArgs = mockPrdFindMany.mock.calls[0][0];
    expect(findManyArgs.where).toHaveProperty("authorId", "user_2");
  });

  it("should filter by tags query parameter", async () => {
    await GET(getRequest({ tags: "auth,security" }) as any);

    const findManyArgs = mockPrdFindMany.mock.calls[0][0];
    expect(findManyArgs.where).toHaveProperty("tags");
    expect(findManyArgs.where.tags).toEqual({ hasSome: ["auth", "security"] });
  });

  it("should filter by date range", async () => {
    await GET(
      getRequest({
        from: "2026-02-12T00:00:00.000Z",
        to: "2026-02-25T23:59:59.000Z",
      }) as any,
    );

    const findManyArgs = mockPrdFindMany.mock.calls[0][0];
    expect(findManyArgs.where).toHaveProperty("updatedAt");
    expect(findManyArgs.where.updatedAt).toHaveProperty("gte");
    expect(findManyArgs.where.updatedAt).toHaveProperty("lte");
  });

  it("should support custom sort and order", async () => {
    await GET(getRequest({ sort: "title", order: "asc" }) as any);

    const findManyArgs = mockPrdFindMany.mock.calls[0][0];
    expect(findManyArgs.orderBy).toEqual({ title: "asc" });
  });

  it("should support custom pagination", async () => {
    mockPrdCount.mockResolvedValue(50);

    await GET(getRequest({ page: "2", limit: "10" }) as any);

    const findManyArgs = mockPrdFindMany.mock.calls[0][0];
    expect(findManyArgs.skip).toBe(10);
    expect(findManyArgs.take).toBe(10);
  });

  it("should return 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/api/errors");
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
  });
});
