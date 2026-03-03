/**
 * /api/prds/[id] — single PRD operations.
 *
 * DELETE - Soft-delete a DRAFT PRD owned by the authenticated user.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { deletePrd } from "@/services/prd-delete-service";
import logger from "@/lib/logger";

// ---------------------------------------------------------------------------
// DELETE /api/prds/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const { id } = await params;

    const result = await deletePrd(id, userId);
    if (!result.ok) return apiError(result.message, result.code);

    return apiSuccess({ deleted: true, identifier: id });
  } catch (error) {
    logger.error({ error }, "Error in public PRD delete");
    return handleApiError(error);
  }
}
