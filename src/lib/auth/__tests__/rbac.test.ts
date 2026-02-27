/**
 * RBAC middleware tests.
 *
 * Verifies that requireAuth, requireRole, and requireAdmin correctly
 * enforce authentication and role-based access control by checking
 * the session returned from next-auth's auth() function.
 */
import { UnauthorizedError, ForbiddenError } from "@/lib/api/errors";

// Mock the auth function from the auth module
jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/lib/auth/auth";
import { requireAuth, requireRole, requireAdmin } from "@/lib/auth/rbac";

const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe("RBAC Middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("requireAuth", () => {
    it("throws UnauthorizedError when session is null", async () => {
      mockAuth.mockResolvedValue(null as any);

      await expect(requireAuth()).rejects.toThrow(UnauthorizedError);
      await expect(requireAuth()).rejects.toThrow("Authentication required");
    });

    it("throws UnauthorizedError when session has no user", async () => {
      mockAuth.mockResolvedValue({ user: undefined } as any);

      await expect(requireAuth()).rejects.toThrow(UnauthorizedError);
    });

    it("returns session when user is authenticated", async () => {
      const session = {
        user: { id: "user-1", email: "test@example.com", role: "AUTHOR" },
        expires: "2099-01-01T00:00:00.000Z",
      };
      mockAuth.mockResolvedValue(session as any);

      const result = await requireAuth();
      expect(result).toEqual(session);
      expect(result.user).toBeDefined();
      expect(result.user!.id).toBe("user-1");
    });
  });

  describe("requireRole", () => {
    it("throws UnauthorizedError when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as any);

      await expect(requireRole("ADMIN")).rejects.toThrow(UnauthorizedError);
    });

    it("throws ForbiddenError when user role does not match", async () => {
      const session = {
        user: { id: "user-1", email: "test@example.com", role: "AUTHOR" },
        expires: "2099-01-01T00:00:00.000Z",
      };
      mockAuth.mockResolvedValue(session as any);

      await expect(requireRole("ADMIN")).rejects.toThrow(ForbiddenError);
      await expect(requireRole("ADMIN")).rejects.toThrow(
        "Insufficient permissions",
      );
    });

    it("throws ForbiddenError when user role is not in allowed list", async () => {
      const session = {
        user: { id: "user-1", email: "test@example.com", role: "AUTHOR" },
        expires: "2099-01-01T00:00:00.000Z",
      };
      mockAuth.mockResolvedValue(session as any);

      await expect(requireRole("ADMIN", "REVIEWER")).rejects.toThrow(
        ForbiddenError,
      );
    });

    it("returns session when user role matches single allowed role", async () => {
      const session = {
        user: { id: "user-1", email: "test@example.com", role: "REVIEWER" },
        expires: "2099-01-01T00:00:00.000Z",
      };
      mockAuth.mockResolvedValue(session as any);

      const result = await requireRole("REVIEWER");
      expect(result).toEqual(session);
    });

    it("returns session when user role matches one of multiple allowed roles", async () => {
      const session = {
        user: { id: "user-1", email: "test@example.com", role: "ADMIN" },
        expires: "2099-01-01T00:00:00.000Z",
      };
      mockAuth.mockResolvedValue(session as any);

      const result = await requireRole("ADMIN", "REVIEWER");
      expect(result).toEqual(session);
    });
  });

  describe("requireAdmin", () => {
    it("allows ADMIN role", async () => {
      const session = {
        user: { id: "user-1", email: "admin@example.com", role: "ADMIN" },
        expires: "2099-01-01T00:00:00.000Z",
      };
      mockAuth.mockResolvedValue(session as any);

      const result = await requireAdmin();
      expect(result).toEqual(session);
    });

    it("rejects AUTHOR role", async () => {
      const session = {
        user: { id: "user-1", email: "test@example.com", role: "AUTHOR" },
        expires: "2099-01-01T00:00:00.000Z",
      };
      mockAuth.mockResolvedValue(session as any);

      await expect(requireAdmin()).rejects.toThrow(ForbiddenError);
    });

    it("rejects REVIEWER role", async () => {
      const session = {
        user: { id: "user-1", email: "test@example.com", role: "REVIEWER" },
        expires: "2099-01-01T00:00:00.000Z",
      };
      mockAuth.mockResolvedValue(session as any);

      await expect(requireAdmin()).rejects.toThrow(ForbiddenError);
    });

    it("throws UnauthorizedError when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as any);

      await expect(requireAdmin()).rejects.toThrow(UnauthorizedError);
    });
  });
});
