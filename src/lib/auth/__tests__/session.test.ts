/**
 * Session helper tests.
 *
 * Verifies that getServerSession correctly delegates to next-auth's
 * auth() function and returns the appropriate session data.
 */

jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/lib/auth/auth";
import { getServerSession } from "@/lib/auth/session";

const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe("getServerSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as any);

    const session = await getServerSession();
    expect(session).toBeNull();
    expect(mockAuth).toHaveBeenCalledTimes(1);
  });

  it("returns session data when authenticated", async () => {
    const mockSession = {
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        role: "AUTHOR",
      },
      expires: "2099-01-01T00:00:00.000Z",
    };
    mockAuth.mockResolvedValue(mockSession as any);

    const session = await getServerSession();
    expect(session).toEqual(mockSession);
    expect(session?.user?.email).toBe("test@example.com");
    expect(mockAuth).toHaveBeenCalledTimes(1);
  });
});
