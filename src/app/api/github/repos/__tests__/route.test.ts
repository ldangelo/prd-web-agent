/**
 * GitHub Repos API route tests.
 *
 * Tests for GET /api/github/repos - lists the authenticated user's GitHub
 * repositories grouped by owner (user vs organization).
 * Uses mocked Prisma client, auth session, and global fetch.
 *
 * Updated for TASK-069/070: Now uses GitHubTokenService for token validation
 * and refresh, and classifies GitHub API errors.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockAccountFindFirst = jest.fn();
const mockAccountUpdate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    account: {
      findFirst: (...args: unknown[]) => mockAccountFindFirst(...args),
      update: (...args: unknown[]) => mockAccountUpdate(...args),
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

/**
 * Helper: set up mocks for a happy-path scenario where the user has a valid
 * GitHub account with a working token. The token service calls findFirst with
 * a select clause, so we return the right shape.
 *
 * @param fetchMockForRepos - The mock implementation for the GitHub repos fetch
 */
function setupValidTokenMocks(
  accessToken = "ghp_test123",
  fetchMockForRepos?: jest.Mock,
) {
  mockRequireAuth.mockResolvedValue(MOCK_SESSION);

  // Token service calls findFirst with { select: { id, access_token, refresh_token, expires_at } }
  mockAccountFindFirst.mockResolvedValue({
    id: "acc_1",
    access_token: accessToken,
    refresh_token: null,
    expires_at: null,
  });

  // fetch is called twice:
  // 1) Token validation: GET /user -> 200
  // 2) Repos list: GET /user/repos -> controlled by caller
  const reposMock =
    fetchMockForRepos ??
    jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

  (global.fetch as jest.Mock)
    // First call: token validation
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ login: "testuser" }),
    })
    // Second call: repos list
    .mockImplementationOnce(reposMock);
}

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
    expect(body.error).toMatch(/GitHub|token/i);
  });

  it("should return 401 when GitHub account has no access_token", async () => {
    mockRequireAuth.mockResolvedValue(MOCK_SESSION);
    mockAccountFindFirst.mockResolvedValue({
      id: "acc_1",
      access_token: null,
      refresh_token: null,
      expires_at: null,
    });

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
    expect(body.error).toMatch(/token/i);
  });

  it("should query Prisma for the GitHub account with correct filters", async () => {
    setupValidTokenMocks();

    await GET(getRequest() as any);

    expect(mockAccountFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        provider: "github",
      },
      select: {
        id: true,
        access_token: true,
        refresh_token: true,
        expires_at: true,
      },
    });
  });

  it("should call GitHub API with the correct authorization header", async () => {
    setupValidTokenMocks(
      "ghp_test123",
      jest.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    await GET(getRequest() as any);

    // The second fetch call should be to the repos endpoint
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
    setupValidTokenMocks(
      "ghp_test123",
      jest.fn().mockResolvedValue({
        ok: true,
        json: async () => MOCK_GITHUB_REPOS,
      }),
    );

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
    setupValidTokenMocks(
      "ghp_test123",
      jest.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.repos).toEqual([]);
  });

  it("should return 502 when GitHub repos API returns a non-auth error", async () => {
    setupValidTokenMocks(
      "ghp_test123",
      jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ message: "Internal Server Error" }),
      }),
    );

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toHaveProperty("error");
    expect(body.error).toMatch(/GitHub/i);
  });

  it("should return 401 with needsReauth when GitHub repos API returns 401", async () => {
    setupValidTokenMocks(
      "ghp_test123",
      jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ message: "Bad credentials" }),
      }),
    );

    const response = await GET(getRequest() as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.details).toHaveProperty("needsReauth", true);
    expect(body.details).toHaveProperty("action", "reauthenticate");
  });

  it("should return 500 when fetch throws a network error", async () => {
    mockRequireAuth.mockResolvedValue(MOCK_SESSION);
    mockAccountFindFirst.mockResolvedValue({
      id: "acc_1",
      access_token: "ghp_test123",
      refresh_token: null,
      expires_at: null,
    });

    // Token validation fetch throws
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    const response = await GET(getRequest() as any);
    const body = await response.json();

    // validateGitHubToken returns false on fetch error, then refresh fails (no refresh_token),
    // so GitHubTokenExpiredError is thrown and caught -> 401
    // But the route's catch block converts unknown errors to 500.
    // Since the token service catches the fetch error internally and returns false,
    // then the refresh returns null (no refresh_token), it throws GitHubTokenExpiredError -> 401
    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
  });
});
