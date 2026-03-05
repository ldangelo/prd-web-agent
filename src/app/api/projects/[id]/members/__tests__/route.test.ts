/**
 * Project members API route tests.
 *
 * Tests for GET /api/projects/[id]/members (list),
 * POST /api/projects/[id]/members (add member by email),
 * PATCH /api/projects/[id]/members/[userId] (update role),
 * and DELETE /api/projects/[id]/members/[userId] (remove member).
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockProjectFindUnique = jest.fn();
const mockProjectMemberFindUnique = jest.fn();
const mockProjectMemberFindMany = jest.fn();
const mockProjectMemberCreate = jest.fn();
const mockProjectMemberUpdate = jest.fn();
const mockProjectMemberDelete = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: (...args: unknown[]) => mockProjectFindUnique(...args),
    },
    projectMember: {
      findUnique: (...args: unknown[]) => mockProjectMemberFindUnique(...args),
      findMany: (...args: unknown[]) => mockProjectMemberFindMany(...args),
      create: (...args: unknown[]) => mockProjectMemberCreate(...args),
      update: (...args: unknown[]) => mockProjectMemberUpdate(...args),
      delete: (...args: unknown[]) => mockProjectMemberDelete(...args),
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

import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[userId]/route";
import { ForbiddenError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMemberParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeUserParams(id: string, userId: string) {
  return { params: Promise.resolve({ id, userId }) };
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/projects/proj_001/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/projects/proj_001/members/user_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_PROJECT = { id: "proj_001", name: "Test Project" };

const MOCK_MEMBERS = [
  {
    id: "pm_1",
    projectId: "proj_001",
    userId: "user_1",
    role: "MEMBER",
    user: { id: "user_1", name: "User One", email: "one@example.com", avatarUrl: null, role: "AUTHOR" },
  },
  {
    id: "pm_2",
    projectId: "proj_001",
    userId: "user_2",
    role: "REVIEWER",
    user: { id: "user_2", name: "User Two", email: "two@example.com", avatarUrl: null, role: "AUTHOR" },
  },
];

// ---------------------------------------------------------------------------
// Tests: GET /api/projects/[id]/members
// ---------------------------------------------------------------------------

describe("GET /api/projects/[id]/members", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", role: "AUTHOR" },
    });
    mockProjectFindUnique.mockResolvedValue(MOCK_PROJECT);
    mockProjectMemberFindUnique.mockResolvedValue({
      id: "pm_1", projectId: "proj_001", userId: "user_1", role: "MEMBER",
    });
    mockProjectMemberFindMany.mockResolvedValue(MOCK_MEMBERS);
  });

  it("should return members list for a project member", async () => {
    const response = await GET(
      new Request("http://localhost/api/projects/proj_001/members") as any,
      makeMemberParams("proj_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  it("should return members for system ADMIN regardless of membership", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", role: "ADMIN" },
    });

    const response = await GET(
      new Request("http://localhost/api/projects/proj_001/members") as any,
      makeMemberParams("proj_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    // Should not check membership for system admin
    expect(mockProjectMemberFindUnique).not.toHaveBeenCalled();
  });

  it("should return 404 when project does not exist", async () => {
    mockProjectFindUnique.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/projects/proj_999/members") as any,
      makeMemberParams("proj_999") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 403 for non-member non-admin", async () => {
    mockProjectMemberFindUnique.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/projects/proj_001/members") as any,
      makeMemberParams("proj_001") as any,
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/projects/[id]/members
// ---------------------------------------------------------------------------

describe("POST /api/projects/[id]/members", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // System admin session
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", role: "ADMIN" },
    });
    mockProjectFindUnique.mockResolvedValue(MOCK_PROJECT);
    mockUserFindUnique.mockResolvedValue({
      id: "user_3", name: "User Three", email: "three@example.com",
    });
    mockProjectMemberFindUnique.mockResolvedValue(null); // Not already a member
    mockProjectMemberCreate.mockResolvedValue({
      id: "pm_new",
      projectId: "proj_001",
      userId: "user_3",
      role: "MEMBER",
      user: { id: "user_3", name: "User Three", email: "three@example.com", avatarUrl: null, role: "AUTHOR" },
    });
  });

  it("should add a member by email and return 201", async () => {
    const response = await POST(
      postRequest({ email: "three@example.com" }) as any,
      makeMemberParams("proj_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toHaveProperty("userId", "user_3");
    expect(body.data).toHaveProperty("role", "MEMBER");
  });

  it("should add a member with a specific role", async () => {
    mockProjectMemberCreate.mockResolvedValue({
      id: "pm_new",
      projectId: "proj_001",
      userId: "user_3",
      role: "APPROVER",
      user: { id: "user_3", name: "User Three", email: "three@example.com", avatarUrl: null, role: "AUTHOR" },
    });

    const response = await POST(
      postRequest({ email: "three@example.com", role: "APPROVER" }) as any,
      makeMemberParams("proj_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockProjectMemberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: "APPROVER" }),
      }),
    );
  });

  it("should return 403 for non-admin non-project-admin", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_member", email: "member@example.com", role: "AUTHOR" },
    });
    // User has MEMBER role — not a project admin
    mockProjectMemberFindUnique.mockResolvedValue({
      id: "pm_1", projectId: "proj_001", userId: "user_member", role: "MEMBER",
    });

    const response = await POST(
      postRequest({ email: "three@example.com" }) as any,
      makeMemberParams("proj_001") as any,
    );

    expect(response.status).toBe(403);
  });

  it("should return 404 when project does not exist", async () => {
    mockProjectFindUnique.mockResolvedValue(null);

    const response = await POST(
      postRequest({ email: "three@example.com" }) as any,
      makeMemberParams("proj_999") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 404 when user with email does not exist", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const response = await POST(
      postRequest({ email: "nobody@example.com" }) as any,
      makeMemberParams("proj_001") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 409 when user is already a member", async () => {
    // System admin skips requireProjectAdmin; only the duplicate check calls findUnique
    mockProjectMemberFindUnique.mockResolvedValue({
      id: "pm_existing", projectId: "proj_001", userId: "user_3",
    });

    const response = await POST(
      postRequest({ email: "three@example.com" }) as any,
      makeMemberParams("proj_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("already a member");
  });

  it("should return 422 when email is missing", async () => {
    const response = await POST(
      postRequest({}) as any,
      makeMemberParams("proj_001") as any,
    );

    expect(response.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// Tests: PATCH /api/projects/[id]/members/[userId]
// ---------------------------------------------------------------------------

describe("PATCH /api/projects/[id]/members/[userId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", role: "ADMIN" },
    });
    mockProjectFindUnique.mockResolvedValue(MOCK_PROJECT);
    mockProjectMemberFindUnique.mockResolvedValue({
      id: "pm_1", projectId: "proj_001", userId: "user_1", role: "MEMBER",
    });
    mockProjectMemberUpdate.mockResolvedValue({
      id: "pm_1",
      projectId: "proj_001",
      userId: "user_1",
      role: "REVIEWER",
      user: { id: "user_1", name: "User One", email: "one@example.com", avatarUrl: null, role: "AUTHOR" },
    });
  });

  it("should update member role and return 200", async () => {
    const response = await PATCH(
      patchRequest({ role: "REVIEWER" }) as any,
      makeUserParams("proj_001", "user_1") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("role", "REVIEWER");
    expect(mockProjectMemberUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { role: "REVIEWER" },
      }),
    );
  });

  it("should return 404 when membership does not exist", async () => {
    mockProjectMemberFindUnique.mockResolvedValue(null);

    const response = await PATCH(
      patchRequest({ role: "REVIEWER" }) as any,
      makeUserParams("proj_001", "user_999") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 403 for non-admin without project admin role", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_member", email: "member@example.com", role: "AUTHOR" },
    });
    mockProjectMemberFindUnique.mockResolvedValue({
      id: "pm_x", projectId: "proj_001", userId: "user_member", role: "MEMBER",
    });

    const response = await PATCH(
      patchRequest({ role: "REVIEWER" }) as any,
      makeUserParams("proj_001", "user_1") as any,
    );

    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests: DELETE /api/projects/[id]/members/[userId]
// ---------------------------------------------------------------------------

describe("DELETE /api/projects/[id]/members/[userId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", role: "ADMIN" },
    });
    mockProjectMemberFindUnique.mockResolvedValue({
      id: "pm_1",
      projectId: "proj_001",
      userId: "user_1",
      role: "MEMBER",
    });
    mockProjectMemberDelete.mockResolvedValue({
      id: "pm_1",
      projectId: "proj_001",
      userId: "user_1",
    });
  });

  it("should remove a member and return 200", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/projects/proj_001/members/user_1", {
        method: "DELETE",
      }) as any,
      makeUserParams("proj_001", "user_1") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("deleted", true);
    expect(mockProjectMemberDelete).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: "proj_001", userId: "user_1" } },
    });
  });

  it("should return 404 when membership does not exist", async () => {
    mockProjectMemberFindUnique.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/projects/proj_001/members/user_999", {
        method: "DELETE",
      }) as any,
      makeUserParams("proj_001", "user_999") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 403 for non-admin without project admin role", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_member", email: "member@example.com", role: "AUTHOR" },
    });
    mockProjectMemberFindUnique.mockResolvedValue({
      id: "pm_x", projectId: "proj_001", userId: "user_member", role: "MEMBER",
    });

    const response = await DELETE(
      new Request("http://localhost/api/projects/proj_001/members/user_1", {
        method: "DELETE",
      }) as any,
      makeUserParams("proj_001", "user_1") as any,
    );

    expect(response.status).toBe(403);
  });
});
