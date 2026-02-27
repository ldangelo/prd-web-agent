/**
 * /api/prds/[id]/submit - Submission pipeline API route.
 *
 * POST - Start the submission pipeline for an approved PRD.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { SubmissionPipelineService } from "@/services/submission-pipeline-service";

// ---------------------------------------------------------------------------
// POST /api/prds/[id]/submit
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const userId = session.user.id;

    const service = new SubmissionPipelineService();
    const steps = await service.execute(id, userId);

    return apiSuccess({ prdId: id, steps });
  } catch (error) {
    return handleApiError(error);
  }
}
