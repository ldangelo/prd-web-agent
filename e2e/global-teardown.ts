/**
 * Playwright globalTeardown — removes E2E fixture data from the test database.
 *
 * Deletes only rows whose IDs start with "e2e-" to guarantee no real data is
 * touched. Deletion order respects foreign-key constraints:
 *   1. Prd (references Project + User)
 *   2. ProjectMember (references Project + User)
 *   3. Project
 *   4. User
 *
 * Also resets any soft-deleted E2E PRDs (isDeleted=true) back to
 * isDeleted=false in case teardown runs before a test's afterEach cleanup —
 * this prevents stale soft-delete state from poisoning the next test run.
 */

import { PrismaClient } from "@prisma/client";

export default async function globalTeardown(): Promise<void> {
  const prisma = new PrismaClient();

  const E2E_PRD_IDS = [
    "e2e-prd-draft",
    "e2e-prd-review",
    "e2e-prd-approved",
    "e2e-prd-other",
  ];

  try {
    // Restore any soft-deleted E2E PRDs so the next run starts clean.
    await prisma.prd.updateMany({
      where: {
        id: { in: E2E_PRD_IDS },
        isDeleted: true,
      },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    // Delete AuditEntry rows (FK: prdId → Prd, userId → User).
    await prisma.auditEntry.deleteMany({
      where: {
        OR: [
          { prdId: { in: E2E_PRD_IDS } },
          { userId: { in: ["e2e-user-1", "e2e-user-2"] } },
        ],
      },
    });

    // Delete PRD rows first (FK: projectId → Project, authorId → User).
    await prisma.prd.deleteMany({
      where: { id: { in: E2E_PRD_IDS } },
    });

    // Delete ProjectMember rows (FK: projectId → Project, userId → User).
    await prisma.projectMember.deleteMany({
      where: {
        projectId: "e2e-proj-1",
        userId: { in: ["e2e-user-1", "e2e-user-2"] },
      },
    });

    // Delete the project.
    await prisma.project.deleteMany({
      where: { id: "e2e-proj-1" },
    });

    // Delete the users.
    await prisma.user.deleteMany({
      where: { id: { in: ["e2e-user-1", "e2e-user-2"] } },
    });

    console.log("[globalTeardown] E2E fixtures removed successfully.");
  } finally {
    await prisma.$disconnect();
  }
}
