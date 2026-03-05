/**
 * /api/prds/[id]/status - PRD status transition API route.
 *
 * POST - Transition the PRD to a new status.
 *        Body: { to: PrdStatus, comment?: string }
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";
import { StatusWorkflowService } from "@/services/status-workflow-service";
import { ensureRepoClone } from "@/app/api/internal/repo/_lib/ensure-clone";

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

    // Before submitting for review, ensure the repo is cloned/mounted.
    // ensureRepoClone attempts an on-demand clone if not already present.
    if (data.to === "IN_REVIEW") {
      const prd = await prisma.prd.findUnique({ where: { id }, select: { projectId: true } });
      if (!prd) throw new NotFoundError("PRD not found");

      const repoResult = await ensureRepoClone(userId, prd.projectId);
      if (repoResult instanceof Response) {
        return repoResult;
      }
    }

    const workflowService = new StatusWorkflowService();
    await workflowService.transition(id, userId, data.to, data.comment);

    return apiSuccess({ prdId: id, status: data.to });
  } catch (error) {
    return handleApiError(error);
  }
}
