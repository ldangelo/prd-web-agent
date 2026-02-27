/**
 * Prisma seed script.
 *
 * Upserts a GlobalSettings row with sensible defaults.
 * Idempotent -- safe to run multiple times.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Default global settings values used by the seed script.
 * Exported so they can be verified in tests.
 */
export const SEED_DEFAULTS = {
  llmProvider: "anthropic",
  llmModel: "claude-sonnet-4-20250514",
  llmThinkingLevel: "medium",
  blockApprovalOnUnresolvedComments: true,
} as const;

/**
 * Run the seed logic.
 *
 * Accepts an optional PrismaClient for testability.
 */
export async function seed(client: PrismaClient = prisma): Promise<void> {
  await client.globalSettings.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      llmProvider: SEED_DEFAULTS.llmProvider,
      llmModel: SEED_DEFAULTS.llmModel,
      llmThinkingLevel: SEED_DEFAULTS.llmThinkingLevel,
      blockApprovalOnUnresolvedComments:
        SEED_DEFAULTS.blockApprovalOnUnresolvedComments,
    },
  });

  console.log("Seeded GlobalSettings with defaults");
}

// Run when executed directly (not imported)
if (require.main === module) {
  seed()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error("Seed failed:", e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
