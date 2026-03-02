/**
 * Tests for GET/PUT /api/user/theme
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}));

const mockRequireAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { GET, PUT } from "../route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_SESSION = { user: { id: "user_1", role: "AUTHOR" } };

function createRequest(
  method: string,
  body?: Record<string, unknown>,
): NextRequest {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest("http://localhost:3000/api/user/theme", init);
}

// ---------------------------------------------------------------------------
// GET tests
// ---------------------------------------------------------------------------

describe("GET /api/user/theme", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(MOCK_SESSION);
  });

  it("returns 401 when unauthenticated", async () => {
    const { UnauthorizedError } = jest.requireActual("@/lib/api/errors") as typeof import("@/lib/api/errors");
    mockRequireAuth.mockRejectedValue(new UnauthorizedError("Authentication required"));

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns stored themePreference for authenticated user", async () => {
    mockUserFindUnique.mockResolvedValue({ themePreference: "DARK" });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.themePreference).toBe("DARK");
  });

  it("returns SYSTEM when no preference set (user not found)", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.themePreference).toBe("SYSTEM");
  });
});

// ---------------------------------------------------------------------------
// PUT tests
// ---------------------------------------------------------------------------

describe("PUT /api/user/theme", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue(MOCK_SESSION);
  });

  it("returns 401 when unauthenticated", async () => {
    const { UnauthorizedError } = jest.requireActual("@/lib/api/errors") as typeof import("@/lib/api/errors");
    mockRequireAuth.mockRejectedValue(new UnauthorizedError("Authentication required"));

    const request = createRequest("PUT", { themePreference: "DARK" });
    const response = await PUT(request);
    expect(response.status).toBe(401);
  });

  it("returns 422 for invalid preference value", async () => {
    const request = createRequest("PUT", { themePreference: "INVALID" });
    const response = await PUT(request);
    expect(response.status).toBe(422);
  });

  it("updates preference to LIGHT", async () => {
    mockUserUpdate.mockResolvedValue({ themePreference: "LIGHT" });

    const request = createRequest("PUT", { themePreference: "LIGHT" });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.themePreference).toBe("LIGHT");
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user_1" },
        data: { themePreference: "LIGHT" },
      }),
    );
  });

  it("updates preference to DARK", async () => {
    mockUserUpdate.mockResolvedValue({ themePreference: "DARK" });

    const request = createRequest("PUT", { themePreference: "DARK" });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.themePreference).toBe("DARK");
  });

  it("updates preference to SYSTEM", async () => {
    mockUserUpdate.mockResolvedValue({ themePreference: "SYSTEM" });

    const request = createRequest("PUT", { themePreference: "SYSTEM" });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.themePreference).toBe("SYSTEM");
  });

  it("returns updated preference in response", async () => {
    mockUserUpdate.mockResolvedValue({ themePreference: "DARK" });

    const request = createRequest("PUT", { themePreference: "DARK" });
    const response = await PUT(request);
    const body = await response.json();

    expect(body.data).toHaveProperty("themePreference", "DARK");
  });

  it("rejects missing themePreference field", async () => {
    const request = createRequest("PUT", {});
    const response = await PUT(request);
    expect(response.status).toBe(422);
  });

  it("rejects unknown enum values", async () => {
    const request = createRequest("PUT", { themePreference: "BLUE" });
    const response = await PUT(request);
    expect(response.status).toBe(422);
  });
});
