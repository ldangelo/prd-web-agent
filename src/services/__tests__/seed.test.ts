/**
 * Prisma seed script tests.
 *
 * Verifies that the seed function upserts GlobalSettings with the
 * expected default values.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpsert = jest.fn().mockResolvedValue({});

const mockPrismaClient = {
  globalSettings: {
    upsert: (...args: unknown[]) => mockUpsert(...args),
  },
} as any;

// We need to mock PrismaClient so the module-level `new PrismaClient()` in
// seed.ts does not attempt a real DB connection.
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

// Use a path relative to the test file location.
// The test sits at src/services/__tests__/, so we need to go up
// three levels to reach the project root, then into prisma/.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { seed, SEED_DEFAULTS } = require("../../../prisma/seed") as typeof import("../../../prisma/seed");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Prisma seed script", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should upsert GlobalSettings with expected defaults", async () => {
    await seed(mockPrismaClient as any);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { id: "global" },
      update: {},
      create: {
        id: "global",
        llmProvider: "anthropic",
        llmModel: "claude-sonnet-4-20250514",
        llmThinkingLevel: "medium",
        blockApprovalOnUnresolvedComments: true,
      },
    });
  });

  it("should export correct SEED_DEFAULTS", () => {
    expect(SEED_DEFAULTS).toEqual({
      llmProvider: "anthropic",
      llmModel: "claude-sonnet-4-20250514",
      llmThinkingLevel: "medium",
      blockApprovalOnUnresolvedComments: true,
    });
  });

  it("should not fail when called multiple times (idempotent)", async () => {
    await seed(mockPrismaClient as any);
    await seed(mockPrismaClient as any);

    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });
});
