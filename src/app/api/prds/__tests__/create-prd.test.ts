/**
 * PRD creation API route tests.
 *
 * Tests for POST /api/prds - creating a new PRD with project association.
 * Uses mocked Prisma client and auth session.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockPrdCreate = jest.fn();
const mockProjectFindUnique = jest.fn();
const mockProjectMemberFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: { create: (...args: unknown[]) => mockPrdCreate(...args) },
    project: {
      findUnique: (...args: unknown[]) => mockProjectFindUnique(...args),
    },
    projectMember: {
      findUnique: (...args: unknown[]) =>
        mockProjectMemberFindUnique(...args),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/prds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/prds", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated user
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", role: "AUTHOR" },
    });

    // Default: project exists
    mockProjectFindUnique.mockResolvedValue({
      id: "proj_001",
      name: "Test Project",
    });

    // Default: user is a member
    mockProjectMemberFindUnique.mockResolvedValue({
      id: "pm_1",
      projectId: "proj_001",
      userId: "user_1",
    });

    // Default: PRD creation succeeds
    mockPrdCreate.mockResolvedValue({
      id: "prd_new_1",
      title: "Untitled PRD",
      projectId: "proj_001",
      authorId: "user_1",
      status: "DRAFT",
      currentVersion: 1,
      createdAt: new Date("2026-02-26T00:00:00.000Z"),
      updatedAt: new Date("2026-02-26T00:00:00.000Z"),
    });
  });

  it("should create a PRD with valid data and return 201", async () => {
    const response = await POST(postRequest({ projectId: "proj_001" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("prdId", "prd_new_1");
  });

  it("should accept an optional description", async () => {
    const response = await POST(
      postRequest({
        projectId: "proj_001",
        description: "A new authentication PRD",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toHaveProperty("prdId");
  });

  it("should call prisma.prd.create with correct data", async () => {
    await POST(
      postRequest({
        projectId: "proj_001",
        description: "Some description",
      }),
    );

    expect(mockPrdCreate).toHaveBeenCalledTimes(1);
    const createArg = mockPrdCreate.mock.calls[0][0];
    expect(createArg.data).toMatchObject({
      projectId: "proj_001",
      authorId: "user_1",
      status: "DRAFT",
    });
  });

  it("should return 422 when projectId is missing", async () => {
    const response = await POST(postRequest({}));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toHaveProperty("error");
  });

  it("should return 401 when user is not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      (() => {
        const err = new Error("Authentication required");
        (err as any).statusCode = 401;
        (err as any).name = "UnauthorizedError";
        return err;
      })(),
    );

    // Re-import to use UnauthorizedError properly
    const { UnauthorizedError } = await import("@/lib/api/errors");
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await POST(postRequest({ projectId: "proj_001" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("should return 404 when project does not exist", async () => {
    mockProjectFindUnique.mockResolvedValue(null);

    const response = await POST(postRequest({ projectId: "proj_999" }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("Project not found");
  });

  it("should return 403 when user is not a project member", async () => {
    mockProjectMemberFindUnique.mockResolvedValue(null);

    const response = await POST(postRequest({ projectId: "proj_001" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("not a member");
  });
});
