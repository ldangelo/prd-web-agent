/**
 * DELETE /api/internal/prd/delete
 *
 * Internal endpoint called by the OpenClaw agent to soft-delete a Draft PRD.
 * Authenticated via OPENCLAW_INTERNAL_TOKEN.
 *
 * Business rules enforced by the shared prd-delete-service:
 * - PRD must exist and not be already deleted
 * - Requesting userId must be the PRD author
 * - PRD must be in DRAFT status
 * - Soft-delete (isDeleted=true, deletedAt=now) + audit entry in a transaction
 * - Search index cleanup is attempted after the transaction (non-blocking)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { deletePrd } from "@/services/prd-delete-service";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { validateInternalToken } from "../../auth";
import logger from "@/lib/logger";

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

    // Delegate to shared service
    const result = await deletePrd(identifier, userId);
    if (!result.ok) return apiError(result.message, result.code);

    return apiSuccess({ deleted: true, identifier });
  } catch (error) {
    logger.error({ error }, "Error in internal PRD delete");
    return handleApiError(error);
  }
}
