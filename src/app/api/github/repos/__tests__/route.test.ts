/**
 * GitHub Repos API route tests.
 *
 * Tests for GET /api/github/repos - lists the authenticated user's GitHub
 * repositories grouped by owner (user vs organization).
 * Uses mocked Prisma client, auth session, and global fetch.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockAccountFindFirst = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    account: {
      findFirst: (...args: unknown[]) => mockAccountFindFirst(...args),
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
import { UnauthorizedError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRequest(): Request {
  return new Request("http://localhost/api/github/repos");
}

const MOCK_SESSION = {
  user: { id: "user_1", email: "dev@example.com", role: "AUTHOR" },
};

const MOCK_GITHUB_REPOS = [
  {
    name: "my-app",
    full_name: "testuser/my-app",
    owner: { login: "testuser", type: "User" },
    description: "A cool app",
    private: false,
  },
  {
    name: "my-lib",
    full_name: "testuser/my-lib",
    owner: { login: "testuser", type: "User" },
    description: "A utility library",
    private: true,
  },
  {
    name: "org-project",
    full_name: "myorg/org-project",
    owner: { login: "myorg", type: "Organization" },
    description: "An org project",
    private: false,
  },
  {
    name: "org-internal",
    full_name: "myorg/org-internal",
    owner: { login: "myorg", type: "Organization" },
    description: null,
    private: true,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/github/repos", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
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

  it("should return 401 when no GitHub account is found", async () => {
    mockRequireAuth.mockResolvedValue(MOCK_SESSION);
    mockAccountFindFirst.mockResolvedValue(null);

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
    expect(body.error).toMatch(/GitHub/i);
  });

  it("should return 401 when GitHub account has no access_token", async () => {
    mockRequireAuth.mockResolvedValue(MOCK_SESSION);
    mockAccountFindFirst.mockResolvedValue({
      id: "acc_1",
      provider: "github",
      access_token: null,
    });

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
    expect(body.error).toMatch(/token/i);
  });

  it("should query Prisma for the GitHub account with correct filters", async () => {
    mockRequireAuth.mockResolvedValue(MOCK_SESSION);
    mockAccountFindFirst.mockResolvedValue({
      id: "acc_1",
      provider: "github",
      access_token: "ghp_test123",
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await GET(getRequest() as any);

    expect(mockAccountFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        provider: "github",
      },
    });
  });

  it("should call GitHub API with the correct authorization header", async () => {
    mockRequireAuth.mockResolvedValue(MOCK_SESSION);
    mockAccountFindFirst.mockResolvedValue({
      id: "acc_1",
      provider: "github",
      access_token: "ghp_test123",
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await GET(getRequest() as any);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://api.github.com/user/repos"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer ghp_test123",
          Accept: "application/vnd.github+json",
        }),
      }),
    );
  });

  it("should return repos grouped by owner", async () => {
    mockRequireAuth.mockResolvedValue(MOCK_SESSION);
    mockAccountFindFirst.mockResolvedValue({
      id: "acc_1",
      provider: "github",
      access_token: "ghp_test123",
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => MOCK_GITHUB_REPOS,
    });

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("repos");

    const { repos } = body.data;
    expect(repos).toHaveLength(2);

    // Find the user group and org group
    const userGroup = repos.find(
      (g: { owner: string }) => g.owner === "testuser",
    );
    const orgGroup = repos.find(
      (g: { owner: string }) => g.owner === "myorg",
    );

    expect(userGroup).toBeDefined();
    expect(userGroup.ownerType).toBe("user");
    expect(userGroup.repos).toHaveLength(2);
    expect(userGroup.repos[0]).toEqual({
      name: "my-app",
      fullName: "testuser/my-app",
      description: "A cool app",
      private: false,
    });

    expect(orgGroup).toBeDefined();
    expect(orgGroup.ownerType).toBe("organization");
    expect(orgGroup.repos).toHaveLength(2);
  });

  it("should return empty repos array when user has no GitHub repos", async () => {
    mockRequireAuth.mockResolvedValue(MOCK_SESSION);
    mockAccountFindFirst.mockResolvedValue({
      id: "acc_1",
      provider: "github",
      access_token: "ghp_test123",
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.repos).toEqual([]);
  });

  it("should return 502 when GitHub API returns an error", async () => {
    mockRequireAuth.mockResolvedValue(MOCK_SESSION);
    mockAccountFindFirst.mockResolvedValue({
      id: "acc_1",
      provider: "github",
      access_token: "ghp_test123",
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toHaveProperty("error");
    expect(body.error).toMatch(/GitHub/i);
  });

  it("should return 500 when fetch throws a network error", async () => {
    mockRequireAuth.mockResolvedValue(MOCK_SESSION);
    mockAccountFindFirst.mockResolvedValue({
      id: "acc_1",
      provider: "github",
      access_token: "ghp_test123",
    });
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toHaveProperty("error");
  });
});
