/**
 * /api/prds/[id] — single PRD operations.
 *
 * DELETE - Soft-delete a DRAFT PRD owned by the authenticated user.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
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

    const { errorResponse, deleted } = await deletePrd(id, userId);
    if (errorResponse) return errorResponse;

    return apiSuccess({ deleted, identifier: id });
  } catch (error) {
    logger.error({ error }, "Error in public PRD delete");
    return handleApiError(error);
  }
}
