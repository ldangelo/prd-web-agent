/**
 * PRD Delete Service.
 *
 * Shared business logic for soft-deleting a DRAFT PRD.
 * Used by both the internal API endpoint (OpenClaw) and the public PRD endpoint.
 *
 * Business rules:
 * - PRD must exist and not already be soft-deleted
 * - userId must be the PRD author (returns 404 for both not-found and wrong-owner)
 * - PRD must be in DRAFT status
 * - Soft-delete + audit entry in a single transaction with re-check to prevent TOCTOU
 * - Search index cleanup is fire-and-forget (failure is logged, not propagated)
 */
import { prisma } from "@/lib/prisma";
import { SearchService } from "@/services/search-service";
import logger from "@/lib/logger";

const searchService = new SearchService();

// Discriminated union — no NextResponse in the service layer
export type DeletePrdResult =
  | { ok: true }
  | { ok: false; code: 404 | 403 | 409; message: string };

/**
 * Soft-delete a PRD.
 *
 * @param identifier - The PRD id to delete
 * @param userId - The user requesting deletion (must be the author)
 * @returns DeletePrdResult discriminated union
 */
export async function deletePrd(
  identifier: string,
  userId: string,
): Promise<DeletePrdResult> {
  // Pre-flight: fetch PRD outside transaction for a fast early-exit
  const prd = await prisma.prd.findFirst({
    where: { id: identifier, isDeleted: false },
  });

  // Return 404 for both not-found and wrong-owner to avoid existence oracle
  if (!prd || prd.authorId !== userId) {
    return { ok: false, code: 404, message: `PRD not found: "${identifier}"` };
  }

  if (prd.status !== "DRAFT") {
    return {
      ok: false,
      code: 409,
      message: `PRD cannot be deleted: status is "${prd.status}", expected "DRAFT"`,
    };
  }

  // Soft-delete + audit entry in a single transaction.
  // Re-check status inside the transaction to prevent TOCTOU race condition.
  await prisma.$transaction(async (tx) => {
    const locked = await tx.prd.findFirst({
      where: { id: identifier, isDeleted: false, status: "DRAFT" },
    });
    if (!locked) {
      throw new Error("PRD is no longer deletable (concurrent modification)");
    }

    await tx.prd.update({
      where: { id: identifier },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    await tx.auditEntry.create({
      data: {
        action: "prd.deleted",
        prdId: identifier,
        userId,
        detail: {
          prdId: identifier,
          title: prd.title,
          timestamp: new Date().toISOString(),
        },
      },
    });
  });

  // Fire-and-forget search index cleanup — never blocks the response
  searchService.deletePrdIndex(identifier).catch((searchErr) => {
    logger.warn(
      { error: searchErr, prdId: identifier },
      "Failed to remove PRD from search index after deletion; continuing",
    );
  });

  logger.info({ prdId: identifier, userId }, "PRD soft-deleted");

  return { ok: true };
}
