/**
 * /api/notifications - User notifications API route.
 *
 * GET - List notifications for the authenticated user.
 *       Supports ?unread=true to filter to unread only.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { getUserNotifications } from "@/services/notification-service";

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unread") === "true";

    const notifications = await getUserNotifications(
      session.user.id,
      unreadOnly,
    );

    return apiSuccess(notifications);
  } catch (error) {
    return handleApiError(error);
  }
}
