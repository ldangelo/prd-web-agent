/**
 * /api/prds/[id]/submit/retry/[step] - Retry a failed submission step.
 *
 * POST - Retry a specific failed step in the submission pipeline.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { SubmissionPipelineService } from "@/services/submission-pipeline-service";

// ---------------------------------------------------------------------------
// POST /api/prds/[id]/submit/retry/[step]
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; step: string }> },
) {
  try {
    const session = await requireAuth();
    const { id, step } = await params;
    const userId = session.user.id;

    const service = new SubmissionPipelineService();
    const result = await service.retryStep(id, step, userId);

    return apiSuccess({ prdId: id, step: result });
  } catch (error) {
    return handleApiError(error);
  }
}
