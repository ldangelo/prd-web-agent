/**
 * /api/notifications/[id]/read - Mark a single notification as read.
 *
 * PUT - Mark the specified notification as read.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { markAsRead } from "@/services/notification-service";

// ---------------------------------------------------------------------------
// PUT /api/notifications/[id]/read
// ---------------------------------------------------------------------------

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const notification = await markAsRead(id, session.user.id);
    if (!notification) {
      throw new NotFoundError("Notification not found");
    }

    return apiSuccess(notification);
  } catch (error) {
    return handleApiError(error);
  }
}
