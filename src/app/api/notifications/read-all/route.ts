/**
 * /api/notifications/read-all - Mark all notifications as read.
 *
 * PUT - Mark all of the authenticated user's notifications as read.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { markAllAsRead } from "@/services/notification-service";

// ---------------------------------------------------------------------------
// PUT /api/notifications/read-all
// ---------------------------------------------------------------------------

export async function PUT(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const count = await markAllAsRead(session.user.id);
    return apiSuccess({ markedAsRead: count });
  } catch (error) {
    return handleApiError(error);
  }
}
