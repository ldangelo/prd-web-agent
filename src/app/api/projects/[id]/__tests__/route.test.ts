/**
 * Single project API route tests.
 *
 * Tests for GET, PUT, DELETE /api/projects/[id].
 * Uses mocked Prisma client and auth session.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockProjectFindUnique = jest.fn();
const mockProjectUpdate = jest.fn();
const mockProjectDelete = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: (...args: unknown[]) => mockProjectFindUnique(...args),
      update: (...args: unknown[]) => mockProjectUpdate(...args),
      delete: (...args: unknown[]) => mockProjectDelete(...args),
    },
  },
}));

const mockRequireAuth = jest.fn();
const mockRequireAdmin = jest.fn();

jest.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
  requireAdmin: () => mockRequireAdmin(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET, PUT, DELETE } from "../route";
import { UnauthorizedError, ForbiddenError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function putRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/projects/proj_001", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_PROJECT = {
  id: "proj_001",
  name: "Test Project",
  description: "A test project",
  confluenceSpace: null,
  jiraProject: null,
  gitRepo: null,
  beadsProject: null,
  members: [
    { userId: "user_1", isReviewer: false, user: { id: "user_1", name: "Test User" } },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/projects/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", role: "AUTHOR" },
    });
    mockProjectFindUnique.mockResolvedValue(MOCK_PROJECT);
  });

  it("should return project details for a member", async () => {
    const response = await GET(
      new Request("http://localhost/api/projects/proj_001") as any,
      makeParams("proj_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("id", "proj_001");
    expect(body.data).toHaveProperty("name", "Test Project");
  });

  it("should return project details for ADMIN regardless of membership", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", role: "ADMIN" },
    });
    // Project members do not include user_admin
    mockProjectFindUnique.mockResolvedValue(MOCK_PROJECT);

    const response = await GET(
      new Request("http://localhost/api/projects/proj_001") as any,
      makeParams("proj_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("id", "proj_001");
  });

  it("should return 404 for non-existent project", async () => {
    mockProjectFindUnique.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/projects/proj_999") as any,
      makeParams("proj_999") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("Project not found");
  });

  it("should return 403 for non-member non-admin", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_other", email: "other@example.com", role: "AUTHOR" },
    });
    mockProjectFindUnique.mockResolvedValue(MOCK_PROJECT);

    const response = await GET(
      new Request("http://localhost/api/projects/proj_001") as any,
      makeParams("proj_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Not a member");
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await GET(
      new Request("http://localhost/api/projects/proj_001") as any,
      makeParams("proj_001") as any,
    );

    expect(response.status).toBe(401);
  });
});

describe("PUT /api/projects/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({
      user: { id: "user_1", email: "admin@example.com", role: "ADMIN" },
    });
    mockProjectFindUnique.mockResolvedValue(MOCK_PROJECT);
    mockProjectUpdate.mockResolvedValue({
      ...MOCK_PROJECT,
      name: "Updated Name",
    });
  });

  it("should update project and return 200 for admin", async () => {
    const response = await PUT(
      putRequest({ name: "Updated Name" }) as any,
      makeParams("proj_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("name", "Updated Name");
    expect(mockProjectUpdate).toHaveBeenCalledWith({
      where: { id: "proj_001" },
      data: { name: "Updated Name" },
    });
  });

  it("should return 404 when project does not exist", async () => {
    mockProjectFindUnique.mockResolvedValue(null);

    const response = await PUT(
      putRequest({ name: "Updated" }) as any,
      makeParams("proj_999") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("Project not found");
  });

  it("should return 403 for non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(
      new ForbiddenError("Insufficient permissions"),
    );

    const response = await PUT(
      putRequest({ name: "Updated" }) as any,
      makeParams("proj_001") as any,
    );

    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/projects/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({
      user: { id: "user_1", email: "admin@example.com", role: "ADMIN" },
    });
    mockProjectFindUnique.mockResolvedValue(MOCK_PROJECT);
    mockProjectDelete.mockResolvedValue(MOCK_PROJECT);
  });

  it("should delete project and return 200 for admin", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/projects/proj_001", { method: "DELETE" }) as any,
      makeParams("proj_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("deleted", true);
    expect(mockProjectDelete).toHaveBeenCalledWith({
      where: { id: "proj_001" },
    });
  });

  it("should return 404 when project does not exist", async () => {
    mockProjectFindUnique.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/projects/proj_999", { method: "DELETE" }) as any,
      makeParams("proj_999") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 403 for non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(
      new ForbiddenError("Insufficient permissions"),
    );

    const response = await DELETE(
      new Request("http://localhost/api/projects/proj_001", { method: "DELETE" }) as any,
      makeParams("proj_001") as any,
    );

    expect(response.status).toBe(403);
  });
});
