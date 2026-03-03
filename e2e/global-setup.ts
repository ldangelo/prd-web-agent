/**
 * Playwright globalSetup — seeds the test database with deterministic E2E fixtures.
 *
 * All fixture rows use the "e2e-*" ID prefix so they are trivially identifiable
 * and can be safely removed by global-teardown.ts without affecting real data.
 *
 * Fixtures created:
 *   Users:          e2e-user-1  (e2e-test@example.com, AUTHOR)
 *                   e2e-user-2  (e2e-other@example.com, AUTHOR)
 *   Project:        e2e-proj-1  (E2E Test Project)
 *   ProjectMembers: e2e-user-1 + e2e-user-2 both in e2e-proj-1
 *   PRDs:           e2e-prd-draft    (DRAFT,     author=e2e-user-1)
 *                   e2e-prd-review   (IN_REVIEW, author=e2e-user-1)
 *                   e2e-prd-approved (APPROVED,  author=e2e-user-1)
 *                   e2e-prd-other    (DRAFT,     author=e2e-user-2)
 *
 * Uses `upsert` throughout so the function is idempotent across re-runs.
 */

import { PrismaClient } from "@prisma/client";

export default async function globalSetup(): Promise<void> {
  // Prisma reads DATABASE_URL from the environment. When running via the
  // Playwright CLI the .env file in the project root is loaded automatically
  // by Next.js / dotenv. If needed, dotenv.config() can be called explicitly.
  const prisma = new PrismaClient();

  try {
    // ------------------------------------------------------------------
    // Users
    // ------------------------------------------------------------------
    await prisma.user.upsert({
      where: { id: "e2e-user-1" },
      create: {
        id: "e2e-user-1",
        email: "e2e-test@example.com",
        name: "E2E Test User",
        role: "AUTHOR",
      },
      update: {
        email: "e2e-test@example.com",
        name: "E2E Test User",
        role: "AUTHOR",
      },
    });

    await prisma.user.upsert({
      where: { id: "e2e-user-2" },
      create: {
        id: "e2e-user-2",
        email: "e2e-other@example.com",
        name: "E2E Other User",
        role: "AUTHOR",
      },
      update: {
        email: "e2e-other@example.com",
        name: "E2E Other User",
        role: "AUTHOR",
      },
    });

    // ------------------------------------------------------------------
    // Project
    // ------------------------------------------------------------------
    await prisma.project.upsert({
      where: { id: "e2e-proj-1" },
      create: {
        id: "e2e-proj-1",
        name: "E2E Test Project",
        description: "Project used exclusively by Playwright E2E tests",
        githubRepo: "https://github.com/e2e-test/repo",
      },
      update: {
        name: "E2E Test Project",
        description: "Project used exclusively by Playwright E2E tests",
        githubRepo: "https://github.com/e2e-test/repo",
      },
    });

    // ------------------------------------------------------------------
    // ProjectMember entries
    // ------------------------------------------------------------------
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: "e2e-proj-1",
          userId: "e2e-user-1",
        },
      },
      create: {
        projectId: "e2e-proj-1",
        userId: "e2e-user-1",
      },
      update: {},
    });

    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: "e2e-proj-1",
          userId: "e2e-user-2",
        },
      },
      create: {
        projectId: "e2e-proj-1",
        userId: "e2e-user-2",
      },
      update: {},
    });

    // ------------------------------------------------------------------
    // PRDs
    // ------------------------------------------------------------------
    await prisma.prd.upsert({
      where: { id: "e2e-prd-draft" },
      create: {
        id: "e2e-prd-draft",
        title: "My Draft PRD",
        status: "DRAFT",
        projectId: "e2e-proj-1",
        authorId: "e2e-user-1",
        isDeleted: false,
        deletedAt: null,
      },
      update: {
        title: "My Draft PRD",
        status: "DRAFT",
        isDeleted: false,
        deletedAt: null,
      },
    });

    await prisma.prd.upsert({
      where: { id: "e2e-prd-review" },
      create: {
        id: "e2e-prd-review",
        title: "In Review PRD",
        status: "IN_REVIEW",
        projectId: "e2e-proj-1",
        authorId: "e2e-user-1",
        isDeleted: false,
        deletedAt: null,
      },
      update: {
        title: "In Review PRD",
        status: "IN_REVIEW",
        isDeleted: false,
        deletedAt: null,
      },
    });

    await prisma.prd.upsert({
      where: { id: "e2e-prd-approved" },
      create: {
        id: "e2e-prd-approved",
        title: "Approved PRD",
        status: "APPROVED",
        projectId: "e2e-proj-1",
        authorId: "e2e-user-1",
        isDeleted: false,
        deletedAt: null,
      },
      update: {
        title: "Approved PRD",
        status: "APPROVED",
        isDeleted: false,
        deletedAt: null,
      },
    });

    await prisma.prd.upsert({
      where: { id: "e2e-prd-other" },
      create: {
        id: "e2e-prd-other",
        title: "Other User Draft",
        status: "DRAFT",
        projectId: "e2e-proj-1",
        authorId: "e2e-user-2",
        isDeleted: false,
        deletedAt: null,
      },
      update: {
        title: "Other User Draft",
        status: "DRAFT",
        isDeleted: false,
        deletedAt: null,
      },
    });

    console.log("[globalSetup] E2E fixtures seeded successfully.");
  } finally {
    await prisma.$disconnect();
  }
}
