/**
 * Notification Service.
 *
 * Manages creation, retrieval, and read-status of user notifications.
 * Optionally pushes real-time events via Socket.io (best-effort).
 */
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";

/** Valid notification types. */
export type NotificationType =
  | "review_requested"
  | "comment"
  | "approved"
  | "rejected"
  | "submitted";

/**
 * Create a notification record and attempt to push it via Socket.io.
 *
 * The Socket.io push is best-effort: any error is logged but does not
 * cause the function to throw.
 *
 * @param userId - The recipient user ID
 * @param type - Notification type
 * @param message - Human-readable message
 * @param prdId - Optional associated PRD ID
 * @returns The created notification record
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  message: string,
  prdId?: string,
) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      message,
      prdId: prdId ?? null,
    },
  });

  // Best-effort real-time push via Socket.io
  try {
    const { webSocketService } = await import("@/services/websocket");
    const io = webSocketService.getIO();
    io.of("/notifications")
      .to(`user:${userId}`)
      .emit("notification", {
        id: notification.id,
        type: notification.type,
        message: notification.message,
        prdId: notification.prdId ?? undefined,
      });
  } catch (err) {
    logger.warn({ err, userId, type }, "Failed to push notification via Socket.io");
  }

  return notification;
}

/**
 * Fetch notifications for a user, optionally filtering to unread only.
 *
 * Results are ordered by creation date descending (newest first).
 *
 * @param userId - The user whose notifications to retrieve
 * @param unreadOnly - When true, only return unread notifications
 * @returns Array of notification records
 */
export async function getUserNotifications(
  userId: string,
  unreadOnly?: boolean,
) {
  const where: { userId: string; read?: boolean } = { userId };
  if (unreadOnly) {
    where.read = false;
  }

  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Mark a single notification as read.
 *
 * @param notificationId - The notification to mark
 * @param userId - The owner (for authorization)
 * @returns The updated notification, or null if not found / not owned
 */
export async function markAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    return null;
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

/**
 * Mark all notifications as read for a given user.
 *
 * @param userId - The user whose notifications to mark
 * @returns The count of updated records
 */
export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  return result.count;
}

/**
 * Get the count of unread notifications for a user.
 *
 * @param userId - The user to check
 * @returns Number of unread notifications
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, read: false },
  });
}
