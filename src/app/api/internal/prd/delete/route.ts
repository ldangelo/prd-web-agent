/**
 * DELETE /api/internal/prd/delete
 *
 * Internal endpoint called by the OpenClaw agent to soft-delete a Draft PRD.
 * Authenticated via OPENCLAW_INTERNAL_TOKEN.
 *
 * Business rules:
 * - PRD must exist and not be already deleted
 * - Requesting userId must be the PRD author
 * - PRD must be in DRAFT status
 * - Soft-delete (isDeleted=true, deletedAt=now) + audit entry in a single transaction
 * - Search index cleanup is attempted after the transaction (non-blocking)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SearchService } from "@/services/search-service";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { validateInternalToken } from "../../auth";
import logger from "@/lib/logger";

const searchService = new SearchService();

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const deleteBodySchema = z.object({
  identifier: z.string().min(1, "identifier is required"),
  userId: z.string().min(1, "userId is required"),
});

// ---------------------------------------------------------------------------
// DELETE handler
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    // Authentication
    const authError = validateInternalToken(request);
    if (authError) return authError;

    // Parse and validate body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiError("Invalid JSON in request body", 400);
    }

    const parsed = deleteBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError("Validation failed", 400, {
        errors: parsed.error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
    }

    const { identifier, userId } = parsed.data;

    // Fetch PRD (only non-deleted records)
    const prd = await prisma.prd.findFirst({
      where: { id: identifier, isDeleted: false },
    });

    if (!prd) {
      return apiError(`PRD not found: "${identifier}"`, 404);
    }

    // Authorization check
    if (prd.authorId !== userId) {
      return apiError("Forbidden: you are not the author of this PRD", 403);
    }

    // Status check — only DRAFT PRDs may be deleted
    if (prd.status !== "DRAFT") {
      return apiError(
        `PRD cannot be deleted: status is "${prd.status}", expected "DRAFT"`,
        409,
      );
    }

    // Soft-delete + audit entry inside a single transaction
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

    logger.info({ prdId: identifier, userId }, "PRD soft-deleted via internal API");

    return apiSuccess({ deleted: true, identifier });
  } catch (error) {
    logger.error({ error }, "Error in internal PRD delete");
    return handleApiError(error);
  }
}
