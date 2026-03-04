/**
 * PRD Delete Service.
 *
 * Shared business logic for soft-deleting a DRAFT PRD.
 * Used by both the internal API endpoint (OpenClaw) and the public PRD endpoint.
 *
 * Business rules:
 * - PRD must exist and not already be soft-deleted
 * - userId must be the PRD author
 * - PRD must be in DRAFT status
 * - Soft-delete + audit entry in a single transaction
 * - Search index cleanup is non-blocking (failure is logged, not propagated)
 */
import { prisma } from "@/lib/prisma";
import { SearchService } from "@/services/search-service";
import { repoCloneService } from "@/lib/repo-clone-service";
import { apiError } from "@/lib/api/response";
import logger from "@/lib/logger";
import { NextResponse } from "next/server";

const searchService = new SearchService();

export interface DeletePrdResult {
  errorResponse: NextResponse | null;
  deleted: boolean;
}

/**
 * Soft-delete a PRD.
 *
 * @param identifier - The PRD id to delete
 * @param userId - The user requesting deletion (must be the author)
 * @returns { errorResponse, deleted } — errorResponse is non-null on failure
 */
export async function deletePrd(
  identifier: string,
  userId: string,
): Promise<DeletePrdResult> {
  // Fetch PRD (only non-deleted records)
  const prd = await prisma.prd.findFirst({
    where: { id: identifier, isDeleted: false },
  });

  if (!prd) {
    return {
      errorResponse: apiError(`PRD not found: "${identifier}"`, 404),
      deleted: false,
    };
  }

  // Authorization
  if (prd.authorId !== userId) {
    return {
      errorResponse: apiError(
        "Forbidden: you are not the author of this PRD",
        403,
      ),
      deleted: false,
    };
  }

  // Status check — only DRAFT PRDs may be deleted
  if (prd.status !== "DRAFT") {
    return {
      errorResponse: apiError(
        `PRD cannot be deleted: status is "${prd.status}", expected "DRAFT"`,
        409,
      ),
      deleted: false,
    };
  }

  // Soft-delete + audit entry in a single transaction
  await prisma.$transaction(async (tx) => {
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

  // Non-blocking search index cleanup
  try {
    await searchService.deletePrdIndex(identifier);
  } catch (searchErr) {
    logger.warn(
      { error: searchErr, prdId: identifier },
      "Failed to remove PRD from search index after deletion; continuing",
    );
  }

  // Non-blocking agent working directory cleanup
  try {
    await repoCloneService.removeClone(userId, prd.projectId);
  } catch (repoErr) {
    logger.warn(
      { error: repoErr, prdId: identifier, projectId: prd.projectId, userId },
      "Failed to remove agent repo clone after PRD deletion; continuing",
    );
  }

  logger.info({ prdId: identifier, userId }, "PRD soft-deleted");

  return { errorResponse: null, deleted: true };
}
