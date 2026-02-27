/**
 * PRD refine API route tests.
 *
 * Tests for POST /api/prds/[id]/refine - loading existing PRD for refinement.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrdFindUnique = jest.fn();
const mockPrdVersionFindFirst = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findUnique: (...args: unknown[]) => mockPrdFindUnique(...args),
    },
    prdVersion: {
      findFirst: (...args: unknown[]) => mockPrdVersionFindFirst(...args),
    },
  },
}));

const mockRequireAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { POST } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postRequest(url: string): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(id: string) {
  return { params: { id } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/prds/[id]/refine", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", role: "AUTHOR" },
    });

    mockPrdFindUnique.mockResolvedValue({
      id: "prd_001",
      title: "User Auth Flow",
      projectId: "proj_001",
      authorId: "user_1",
      status: "DRAFT",
      currentVersion: 2,
    });

    mockPrdVersionFindFirst.mockResolvedValue({
      id: "ver_001",
      prdId: "prd_001",
      version: 2,
      content: "# User Auth Flow\n\nExisting PRD content here.",
    });
  });

  it("should load existing PRD and return 200 with prdId", async () => {
    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/refine"),
      makeContext("prd_001"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("prdId", "prd_001");
    expect(body.data).toHaveProperty("currentVersion", 2);
    expect(body.data).toHaveProperty("content");
  });

  it("should return 404 for non-existent PRD", async () => {
    mockPrdFindUnique.mockResolvedValue(null);

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_999/refine"),
      makeContext("prd_999"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("PRD not found");
  });

  it("should return 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/api/errors");
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/refine"),
      makeContext("prd_001"),
    );

    expect(response.status).toBe(401);
  });

  it("should return latest version content", async () => {
    const response = await POST(
      postRequest("http://localhost/api/prds/prd_001/refine"),
      makeContext("prd_001"),
    );
    const body = await response.json();

    expect(body.data.content).toContain("User Auth Flow");
    expect(mockPrdVersionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { prdId: "prd_001" },
        orderBy: { version: "desc" },
      }),
    );
  });
});
