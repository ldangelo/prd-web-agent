/**
 * /api/agent/sessions - Agent session management API.
 *
 * GET - List active/persisted sessions for the current user.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { listUserSessions } from "@/services/agent/session-persistence";

// ---------------------------------------------------------------------------
// GET /api/agent/sessions
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    const persistedSessions = await listUserSessions(userId);

    const sessions = persistedSessions.map((s) => ({
      sessionId: s.sessionId,
      lastActivity: s.createdAt.getTime(),
    }));

    return apiSuccess({ sessions });
  } catch (error) {
    return handleApiError(error);
  }
}
