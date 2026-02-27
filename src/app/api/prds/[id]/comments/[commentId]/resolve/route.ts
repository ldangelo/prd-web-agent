/**
 * /api/prds/[id]/comments/[commentId]/resolve - Toggle comment resolution.
 *
 * PUT - Resolve or unresolve a comment.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { resolveComment } from "@/services/comment-service";

// ---------------------------------------------------------------------------
// PUT /api/prds/[id]/comments/[commentId]/resolve
// ---------------------------------------------------------------------------

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  try {
    const session = await requireAuth();
    const { commentId } = await params;

    const updated = await resolveComment(commentId, session.user.id);
    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
