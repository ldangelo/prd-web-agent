/**
 * PRD Access Service.
 *
 * Provides authorization checks for PRD access and editing.
 * Centralizes permission logic used across API routes.
 */
import { prisma } from "@/lib/prisma";

/**
 * Check if a user can access (view) a PRD.
 *
 * A user can access a PRD if they are:
 * - The primary author
 * - A co-author
 * - A project member
 * - An admin
 *
 * @param userId - The user ID to check
 * @param prdId - The PRD ID to check access for
 * @returns true if the user can access the PRD
 */
export async function canAccessPrd(
  userId: string,
  prdId: string,
): Promise<boolean> {
  const prd = await prisma.prd.findUnique({ where: { id: prdId } });
  if (!prd) return false;

  // Check if user is the primary author
  if (prd.authorId === userId) return true;

  // Check if user is an admin
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  // Check if user is a co-author
  const coAuthor = await prisma.prdCoAuthor.findUnique({
    where: { prdId_userId: { prdId, userId } },
  });
  if (coAuthor) return true;

  // Check if user is a project member
  const projectMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: prd.projectId, userId } },
  });
  if (projectMember) return true;

  return false;
}

/**
 * Check if a user can edit a PRD.
 *
 * A user can edit a PRD if they are:
 * - The primary author
 * - A co-author
 * - An admin
 *
 * Note: Regular project members can view but not edit.
 *
 * @param userId - The user ID to check
 * @param prdId - The PRD ID to check edit access for
 * @returns true if the user can edit the PRD
 */
export async function canEditPrd(
  userId: string,
  prdId: string,
): Promise<boolean> {
  const prd = await prisma.prd.findUnique({ where: { id: prdId } });
  if (!prd) return false;

  // Check if user is the primary author
  if (prd.authorId === userId) return true;

  // Check if user is an admin
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  // Check if user is a co-author
  const coAuthor = await prisma.prdCoAuthor.findUnique({
    where: { prdId_userId: { prdId, userId } },
  });
  if (coAuthor) return true;

  return false;
}

/**
 * Check if a user is the primary author or an admin.
 *
 * This is a stricter check than canEditPrd - co-authors do not qualify.
 * Used for operations like managing co-authors.
 *
 * @param userId - The user ID to check
 * @param prdId - The PRD ID to check ownership for
 * @returns true if the user is the primary author or an admin
 */
export async function isAuthorOrAdmin(
  userId: string,
  prdId: string,
): Promise<boolean> {
  const prd = await prisma.prd.findUnique({ where: { id: prdId } });
  if (!prd) return false;

  // Check if user is the primary author
  if (prd.authorId === userId) return true;

  // Check if user is an admin
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  return false;
}
