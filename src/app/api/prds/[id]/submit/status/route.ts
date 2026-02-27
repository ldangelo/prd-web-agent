/**
 * /api/prds/[id]/submit/status - Submission step status API route.
 *
 * GET - Get the current status of all submission pipeline steps.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { SubmissionPipelineService } from "@/services/submission-pipeline-service";

// ---------------------------------------------------------------------------
// GET /api/prds/[id]/submit/status
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const service = new SubmissionPipelineService();
    const steps = await service.getStepStatuses(id);

    return apiSuccess({ prdId: id, steps });
  } catch (error) {
    return handleApiError(error);
  }
}
