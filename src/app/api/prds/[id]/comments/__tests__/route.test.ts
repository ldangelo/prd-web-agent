/**
 * Comments API route tests.
 *
 * Tests for GET /api/prds/[id]/comments, POST /api/prds/[id]/comments,
 * and PATCH /api/prds/[id]/comments/[commentId]/resolve.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockPrdFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findUnique: (...args: unknown[]) => mockPrdFindUnique(...args),
    },
  },
}));

const mockRequireAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

const mockCanAccessPrd = jest.fn();
jest.mock("@/services/prd-access-service", () => ({
  canAccessPrd: (...args: unknown[]) => mockCanAccessPrd(...args),
}));

const mockListComments = jest.fn();
const mockCreateComment = jest.fn();
const mockResolveComment = jest.fn();
jest.mock("@/services/comment-service", () => ({
  listComments: (...args: unknown[]) => mockListComments(...args),
  createComment: (...args: unknown[]) => mockCreateComment(...args),
  resolveComment: (...args: unknown[]) => mockResolveComment(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET, POST } from "../route";
import { PATCH } from "../[commentId]/resolve/route";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeResolveParams(id: string, commentId: string) {
  return { params: Promise.resolve({ id, commentId }) };
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/prds/prd_001/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(): Request {
  return new Request("http://localhost/api/prds/prd_001/comments", {
    method: "GET",
  });
}

const MOCK_PRD = {
  id: "prd_001",
  title: "Test PRD",
  authorId: "user_author",
  projectId: "proj_001",
};

const MOCK_COMMENT = {
  id: "comment_001",
  prdId: "prd_001",
  authorId: "user_commenter",
  parentId: null,
  body: "Test comment",
  resolved: false,
  resolvedBy: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  author: {
    id: "user_commenter",
    name: "Commenter",
    email: "commenter@test.com",
    avatarUrl: null,
  },
  replies: [],
};

// ---------------------------------------------------------------------------
// Tests: GET /api/prds/[id]/comments
// ---------------------------------------------------------------------------

describe("GET /api/prds/[id]/comments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_001", email: "user@test.com", role: "AUTHOR" },
    });
    mockPrdFindUnique.mockResolvedValue(MOCK_PRD);
    mockCanAccessPrd.mockResolvedValue(true);
    mockListComments.mockResolvedValue([MOCK_COMMENT]);
  });

  it("should return threaded comments with 200", async () => {
    const response = await GET(
      getRequest() as any,
      makeParams("prd_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toHaveProperty("id", "comment_001");
    expect(body.data[0]).toHaveProperty("replies");
  });

  it("should return 404 when PRD does not exist", async () => {
    mockPrdFindUnique.mockResolvedValue(null);

    const response = await GET(
      getRequest() as any,
      makeParams("prd_999") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 403 when user lacks access", async () => {
    mockCanAccessPrd.mockResolvedValue(false);

    const response = await GET(
      getRequest() as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(403);
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await GET(
      getRequest() as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/prds/[id]/comments
// ---------------------------------------------------------------------------

describe("POST /api/prds/[id]/comments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_commenter", email: "commenter@test.com", role: "AUTHOR" },
    });
    mockPrdFindUnique.mockResolvedValue(MOCK_PRD);
    mockCanAccessPrd.mockResolvedValue(true);
    mockCreateComment.mockResolvedValue(MOCK_COMMENT);
  });

  it("should create a comment and return 201", async () => {
    const response = await POST(
      postRequest({ body: "Test comment" }) as any,
      makeParams("prd_001") as any,
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data).toHaveProperty("id", "comment_001");
    expect(mockCreateComment).toHaveBeenCalledWith(
      "prd_001",
      "user_commenter",
      "Test comment",
      undefined,
    );
  });

  it("should create a reply with parentId", async () => {
    const response = await POST(
      postRequest({ body: "A reply", parentId: "comment_001" }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(201);
    expect(mockCreateComment).toHaveBeenCalledWith(
      "prd_001",
      "user_commenter",
      "A reply",
      "comment_001",
    );
  });

  it("should return 422 when body is missing", async () => {
    const response = await POST(
      postRequest({}) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(422);
  });

  it("should return 404 when PRD does not exist", async () => {
    mockPrdFindUnique.mockResolvedValue(null);

    const response = await POST(
      postRequest({ body: "test" }) as any,
      makeParams("prd_999") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 403 when user lacks access", async () => {
    mockCanAccessPrd.mockResolvedValue(false);

    const response = await POST(
      postRequest({ body: "test" }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(403);
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await POST(
      postRequest({ body: "test" }) as any,
      makeParams("prd_001") as any,
    );

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests: PATCH /api/prds/[id]/comments/[commentId]/resolve
// ---------------------------------------------------------------------------

describe("PATCH /api/prds/[id]/comments/[commentId]/resolve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_author", email: "author@test.com", role: "AUTHOR" },
    });
    mockResolveComment.mockResolvedValue({
      ...MOCK_COMMENT,
      resolved: true,
      resolvedBy: "user_author",
    });
  });

  it("should resolve a comment and return 200", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/prds/prd_001/comments/comment_001/resolve", {
        method: "PATCH",
      }) as any,
      makeResolveParams("prd_001", "comment_001") as any,
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toHaveProperty("resolved", true);
    expect(mockResolveComment).toHaveBeenCalledWith(
      "comment_001",
      "user_author",
    );
  });

  it("should return 404 when comment does not exist", async () => {
    mockResolveComment.mockRejectedValue(
      new NotFoundError("Comment not found"),
    );

    const response = await PATCH(
      new Request("http://localhost/api/prds/prd_001/comments/nonexistent/resolve", {
        method: "PATCH",
      }) as any,
      makeResolveParams("prd_001", "nonexistent") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 403 when user is unauthorized to resolve", async () => {
    mockResolveComment.mockRejectedValue(
      new ForbiddenError("Only the PRD author, comment author, or an admin can resolve comments"),
    );

    const response = await PATCH(
      new Request("http://localhost/api/prds/prd_001/comments/comment_001/resolve", {
        method: "PATCH",
      }) as any,
      makeResolveParams("prd_001", "comment_001") as any,
    );

    expect(response.status).toBe(403);
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await PATCH(
      new Request("http://localhost/api/prds/prd_001/comments/comment_001/resolve", {
        method: "PATCH",
      }) as any,
      makeResolveParams("prd_001", "comment_001") as any,
    );

    expect(response.status).toBe(401);
  });
});
