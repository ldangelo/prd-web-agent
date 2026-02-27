/**
 * /api/prds/[id]/audit - PRD audit trail API route.
 *
 * GET - Returns the full audit trail for a PRD in chronological order.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { AuditService } from "@/services/audit-service";

// ---------------------------------------------------------------------------
// GET /api/prds/[id]/audit
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;

    const auditService = new AuditService();
    const entries = await auditService.getAuditTrail(id);

    return apiSuccess(entries);
  } catch (error) {
    return handleApiError(error);
  }
}
