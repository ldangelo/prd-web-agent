/**
 * /api/prds/[id]/status - PRD status transition API route.
 *
 * POST - Transition the PRD to a new status.
 *        Body: { to: PrdStatus, comment?: string }
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";
import { StatusWorkflowService } from "@/services/status-workflow-service";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const TransitionSchema = z.object({
  to: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "SUBMITTED"]),
  comment: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/prds/[id]/status
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const userId = session.user.id;

    const data = await validateBody(TransitionSchema, request);

    const workflowService = new StatusWorkflowService();
    await workflowService.transition(id, userId, data.to, data.comment);

    return apiSuccess({ prdId: id, status: data.to });
  } catch (error) {
    return handleApiError(error);
  }
}
