/**
 * Projects API route tests.
 *
 * Tests for GET /api/projects (list) and POST /api/projects (create).
 * Uses mocked Prisma client and auth session.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockProjectFindMany = jest.fn();
const mockProjectCreate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findMany: (...args: unknown[]) => mockProjectFindMany(...args),
      create: (...args: unknown[]) => mockProjectCreate(...args),
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

import { GET, POST } from "../route";
import { UnauthorizedError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRequest(): Request {
  return new Request("http://localhost/api/projects");
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_PROJECTS = [
  {
    id: "proj_001",
    name: "Project A",
    description: "First project",
    members: [{ userId: "user_1" }],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/projects", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return all projects for ADMIN user", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_1", email: "admin@example.com", role: "ADMIN" },
    });
    mockProjectFindMany.mockResolvedValue(MOCK_PROJECTS);

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    // Admin query should not have a where clause with members filter
    expect(mockProjectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { members: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("should return only member projects for non-ADMIN user", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_1", email: "author@example.com", role: "AUTHOR" },
    });
    mockProjectFindMany.mockResolvedValue(MOCK_PROJECTS);

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    // Non-admin query should filter by membership
    expect(mockProjectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          members: {
            some: { userId: "user_1" },
          },
        },
      }),
    );
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
  });
});

describe("POST /api/projects", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user: { id: "user_1", email: "user@example.com", role: "AUTHOR" },
    });

    mockProjectCreate.mockResolvedValue({
      id: "proj_new",
      name: "New Project",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("should create a project and return 201 for authenticated user", async () => {
    const response = await POST(
      postRequest({ name: "New Project" }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("id", "proj_new");
    expect(body.data).toHaveProperty("name", "New Project");
  });

  it("should pass all fields to prisma.project.create", async () => {
    await POST(
      postRequest({
        name: "Full Project",
        description: "A description",
        confluenceSpace: "SPACE",
        jiraProject: "JIRA",
        gitRepo: "repo",
        beadsProject: "beads",
      }) as any,
    );

    expect(mockProjectCreate).toHaveBeenCalledWith({
      data: {
        name: "Full Project",
        description: "A description",
        confluenceSpace: "SPACE",
        jiraProject: "JIRA",
        gitRepo: "repo",
        beadsProject: "beads",
      },
    });
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await POST(
      postRequest({ name: "New Project" }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("should return 422 when name is missing", async () => {
    const response = await POST(
      postRequest({ description: "No name" }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toHaveProperty("error");
  });

  it("should return 422 when name is empty", async () => {
    const response = await POST(postRequest({ name: "" }) as any);

    expect(response.status).toBe(422);
  });
});
