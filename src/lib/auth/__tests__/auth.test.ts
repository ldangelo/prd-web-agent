/**
 * Auth configuration tests.
 *
 * Verifies that the NextAuth configuration uses the GitHub OAuth provider
 * with the correct scopes and profile mapping.
 */

// We need to test the auth module's configuration, so we'll verify
// the exported auth config by examining the module structure.

// Mock next-auth to capture the config passed to NextAuth()
let capturedConfig: any = null;
jest.mock("next-auth", () => {
  return {
    __esModule: true,
    default: (config: any) => {
      capturedConfig = config;
      return {
        auth: jest.fn(),
        handlers: { GET: jest.fn(), POST: jest.fn() },
        signIn: jest.fn(),
        signOut: jest.fn(),
      };
    },
  };
});

jest.mock("next-auth/providers/github", () => {
  return {
    __esModule: true,
    default: (opts: any) => ({ id: "github", name: "GitHub", ...opts }),
  };
});

// Mock Google provider in case it's still imported during transition
jest.mock("next-auth/providers/google", () => {
  return {
    __esModule: true,
    default: (opts: any) => ({ id: "google", name: "Google", ...opts }),
  };
});

jest.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: jest.fn(() => ({})),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

describe("Auth Configuration", () => {
  beforeAll(async () => {
    // Import the auth module to trigger NextAuth() call
    await import("@/lib/auth/auth");
  });

  it("uses GitHub as the OAuth provider", () => {
    expect(capturedConfig).toBeDefined();
    const providers = capturedConfig.providers;
    expect(providers).toHaveLength(1);
    expect(providers[0].id).toBe("github");
  });

  it("requests repo, read:user, and user:email scopes", () => {
    const provider = capturedConfig.providers[0];
    const scopes = provider.authorization?.params?.scope;
    expect(scopes).toContain("repo");
    expect(scopes).toContain("read:user");
    expect(scopes).toContain("user:email");
  });

  it("uses JWT session strategy", () => {
    expect(capturedConfig.session.strategy).toBe("jwt");
  });

  it("maps GitHub profile to User model fields", () => {
    const provider = capturedConfig.providers[0];
    expect(provider.profile).toBeDefined();

    const mockGithubProfile = {
      id: 12345,
      login: "testuser",
      name: "Test User",
      email: "test@example.com",
      avatar_url: "https://github.com/testuser.png",
    };

    const mapped = provider.profile(mockGithubProfile);
    expect(mapped.oauthId).toBe("12345");
    expect(mapped.oauthProvider).toBe("github");
    expect(mapped.role).toBe("AUTHOR");
    expect(mapped.name).toBe("Test User");
    expect(mapped.email).toBe("test@example.com");
    expect(mapped.image).toBe("https://github.com/testuser.png");
  });

  it("persists user id and role into JWT token", async () => {
    const jwtCallback = capturedConfig.callbacks.jwt;
    const token = await jwtCallback({
      token: {},
      user: { id: "user-1", role: "ADMIN" },
    });
    expect(token.id).toBe("user-1");
    expect(token.role).toBe("ADMIN");
  });

  it("defaults role to AUTHOR in JWT when user has no role", async () => {
    const jwtCallback = capturedConfig.callbacks.jwt;
    const token = await jwtCallback({
      token: {},
      user: { id: "user-2" },
    });
    expect(token.role).toBe("AUTHOR");
  });

  it("exposes user id and role in session", async () => {
    const sessionCallback = capturedConfig.callbacks.session;
    const session = await sessionCallback({
      session: { user: { email: "test@example.com" } },
      token: { id: "user-1", role: "REVIEWER" },
    });
    expect(session.user.id).toBe("user-1");
    expect(session.user.role).toBe("REVIEWER");
  });

  it("uses PrismaAdapter", () => {
    const { PrismaAdapter } = require("@auth/prisma-adapter");
    expect(PrismaAdapter).toHaveBeenCalled();
    expect(capturedConfig.adapter).toBeDefined();
  });

  it("redirects sign-in to /login page", () => {
    expect(capturedConfig.pages.signIn).toBe("/login");
  });
});
