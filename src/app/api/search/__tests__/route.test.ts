/**
 * Search API route tests.
 *
 * Tests for GET /api/search - full-text search via OpenSearch.
 * Mocks the SearchService and auth session.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockSearchPrds = jest.fn();

jest.mock("@/services/search-service", () => ({
  SearchService: jest.fn().mockImplementation(() => ({
    searchPrds: (...args: unknown[]) => mockSearchPrds(...args),
  })),
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
  const url = new URL("http://localhost/api/search");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString(), { method: "GET" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", role: "AUTHOR" },
    });
  });

  it("should return search results for a valid query", async () => {
    mockSearchPrds.mockResolvedValue({
      total: 1,
      hits: [
        {
          id: "prd_001",
          score: 1.5,
          title: "Authentication Flow",
          content: "Auth content",
          projectId: "proj_001",
          authorId: "user_001",
          status: "DRAFT",
          tags: ["auth"],
          version: 1,
          highlight: {
            title: ["<em>Authentication</em> Flow"],
          },
        },
      ],
    });

    const response = await GET(getRequest({ q: "Authentication" }) as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("total", 1);
    expect(body.data).toHaveProperty("hits");
    expect(body.data.hits).toHaveLength(1);
    expect(body.data.hits[0]).toHaveProperty("highlight");
  });

  it("should return 400 when query parameter is missing", async () => {
    const response = await GET(getRequest({}) as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("should return 400 when query parameter is empty", async () => {
    const response = await GET(getRequest({ q: "" }) as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("should pass filters to the search service", async () => {
    mockSearchPrds.mockResolvedValue({ total: 0, hits: [] });

    await GET(
      getRequest({
        q: "test",
        project: "proj_001",
        status: "DRAFT",
        from: "2026-01-01",
        to: "2026-12-31",
      }) as any,
    );

    expect(mockSearchPrds).toHaveBeenCalledWith("test", {
      projectId: "proj_001",
      status: "DRAFT",
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("should return 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/api/errors");
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await GET(getRequest({ q: "test" }) as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toHaveProperty("error");
  });
});
