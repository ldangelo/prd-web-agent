/**
 * /api/agent/sessions/[sessionId]/resume - Resume a persisted agent session.
 *
 * POST - Triggers cold resume from EFS-backed session storage.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { findSessionFile } from "@/services/agent/session-persistence";

// ---------------------------------------------------------------------------
// POST /api/agent/sessions/[sessionId]/resume
// ---------------------------------------------------------------------------

export async function POST(
  _request: NextRequest,
  context: { params: { sessionId: string } },
) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const { sessionId } = context.params;

    const filePath = await findSessionFile(sessionId, userId);
    if (!filePath) {
      throw new NotFoundError("Session not found");
    }

    // The actual session resume (loading into memory) happens via WebSocket.
    // This endpoint confirms the session file exists and is resumable.
    return apiSuccess({ sessionId });
  } catch (error) {
    return handleApiError(error);
  }
}
