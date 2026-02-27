/**
 * GitHub token service tests (TDD: Red phase)
 *
 * TASK-070: Handle OAuth token expiration with token retrieval,
 * refresh, and validation.
 */
import { GitHubTokenService } from "../token-service";
import { GitHubTokenExpiredError } from "../errors";

// Mock prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    account: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

const { prisma } = require("@/lib/prisma") as {
  prisma: {
    account: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
};

describe("GitHubTokenService", () => {
  let service: GitHubTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GitHubTokenService();
  });

  // -------------------------------------------------------------------------
  // getGitHubToken
  // -------------------------------------------------------------------------

  describe("getGitHubToken", () => {
    it("should return access_token from Account table", async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: "acc-1",
        access_token: "gho_validtoken123",
        refresh_token: null,
      });

      const token = await service.getGitHubToken("user-1");

      expect(token).toBe("gho_validtoken123");
      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-1", provider: "github" },
        select: { id: true, access_token: true, refresh_token: true, expires_at: true },
      });
    });

    it("should return null if no GitHub account exists", async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      const token = await service.getGitHubToken("user-1");

      expect(token).toBeNull();
    });

    it("should return null if access_token is null", async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: "acc-1",
        access_token: null,
        refresh_token: null,
      });

      const token = await service.getGitHubToken("user-1");

      expect(token).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // refreshGitHubToken
  // -------------------------------------------------------------------------

  describe("refreshGitHubToken", () => {
    it("should refresh the token using refresh_token and return new access_token", async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: "acc-1",
        access_token: "gho_old",
        refresh_token: "ghr_refreshtoken",
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "gho_newtoken",
          refresh_token: "ghr_newrefresh",
          expires_in: 28800,
        }),
      });

      const newToken = await service.refreshGitHubToken("user-1");

      expect(newToken).toBe("gho_newtoken");
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: "acc-1" },
        data: expect.objectContaining({
          access_token: "gho_newtoken",
          refresh_token: "ghr_newrefresh",
        }),
      });
    });

    it("should return null if no refresh_token exists", async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: "acc-1",
        access_token: "gho_old",
        refresh_token: null,
      });

      const newToken = await service.refreshGitHubToken("user-1");

      expect(newToken).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return null if no account exists", async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      const newToken = await service.refreshGitHubToken("user-1");

      expect(newToken).toBeNull();
    });

    it("should return null if GitHub refresh endpoint returns error", async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: "acc-1",
        access_token: "gho_old",
        refresh_token: "ghr_refreshtoken",
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "bad_refresh_token" }),
      });

      const newToken = await service.refreshGitHubToken("user-1");

      expect(newToken).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // validateGitHubToken
  // -------------------------------------------------------------------------

  describe("validateGitHubToken", () => {
    it("should return true for a valid token", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ login: "testuser" }),
      });

      const valid = await service.validateGitHubToken("gho_validtoken");

      expect(valid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith("https://api.github.com/user", {
        headers: {
          Authorization: "Bearer gho_validtoken",
          Accept: "application/vnd.github+json",
        },
      });
    });

    it("should return false for an expired/invalid token (401)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Bad credentials" }),
      });

      const valid = await service.validateGitHubToken("gho_expired");

      expect(valid).toBe(false);
    });

    it("should return false if fetch throws", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const valid = await service.validateGitHubToken("gho_whatever");

      expect(valid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getValidTokenOrRefresh
  // -------------------------------------------------------------------------

  describe("getValidTokenOrRefresh", () => {
    it("should return existing token if valid", async () => {
      prisma.account.findFirst.mockResolvedValue({
        id: "acc-1",
        access_token: "gho_valid",
        refresh_token: null,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ login: "user" }),
      });

      const token = await service.getValidTokenOrRefresh("user-1");

      expect(token).toBe("gho_valid");
    });

    it("should attempt refresh if token is invalid and refresh_token exists", async () => {
      // First call: getGitHubToken
      prisma.account.findFirst
        .mockResolvedValueOnce({
          id: "acc-1",
          access_token: "gho_expired",
          refresh_token: "ghr_refresh",
        })
        // Second call: refreshGitHubToken
        .mockResolvedValueOnce({
          id: "acc-1",
          access_token: "gho_expired",
          refresh_token: "ghr_refresh",
        });

      // First fetch: validateGitHubToken returns false
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Bad credentials" }),
      });

      // Second fetch: GitHub OAuth refresh succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "gho_new",
          refresh_token: "ghr_new",
          expires_in: 28800,
        }),
      });

      prisma.account.update.mockResolvedValue({});

      const token = await service.getValidTokenOrRefresh("user-1");

      expect(token).toBe("gho_new");
    });

    it("should throw GitHubTokenExpiredError if no token and no refresh possible", async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.getValidTokenOrRefresh("user-1")).rejects.toThrow(
        GitHubTokenExpiredError,
      );
    });

    it("should throw GitHubTokenExpiredError if token invalid and refresh fails", async () => {
      prisma.account.findFirst
        .mockResolvedValueOnce({
          id: "acc-1",
          access_token: "gho_expired",
          refresh_token: "ghr_bad",
        })
        .mockResolvedValueOnce({
          id: "acc-1",
          access_token: "gho_expired",
          refresh_token: "ghr_bad",
        });

      // validate returns false
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Bad credentials" }),
      });

      // refresh fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "bad_refresh_token" }),
      });

      await expect(service.getValidTokenOrRefresh("user-1")).rejects.toThrow(
        GitHubTokenExpiredError,
      );
    });
  });
});
