/**
 * Notification Namespace — /notifications
 *
 * Delivers real-time notifications to authenticated users.
 * This is a server-to-client only namespace — clients connect
 * and join their user room to receive push notifications.
 */

import { Server as SocketServer, Socket } from "socket.io";

// ---------------------------------------------------------------------------
// Server -> Client events
// ---------------------------------------------------------------------------

export interface NotificationServerEvents {
  notification: (data: {
    id: string;
    type: string;
    message: string;
    prdId?: string;
  }) => void;
}

// ---------------------------------------------------------------------------
// Authentication middleware
// ---------------------------------------------------------------------------

function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): void {
  const userId = socket.handshake.auth?.userId;

  if (!userId) {
    return next(new Error("Authentication required: userId missing"));
  }

  socket.data.userId = userId;
  next();
}

// ---------------------------------------------------------------------------
// Namespace registration
// ---------------------------------------------------------------------------

/**
 * Register the /notifications namespace on the given Socket.io server.
 *
 * Sets up:
 *  - Authentication middleware
 *  - User room joining on connect
 *  - Disconnect cleanup
 */
export function registerNotificationNamespace(io: SocketServer): void {
  const notifNs = io.of("/notifications");

  notifNs.use(authMiddleware);

  notifNs.on("connection", (socket: Socket) => {
    const userId = socket.handshake.auth?.userId;

    // Join user-specific room for targeted notification delivery
    socket.join(`user:${userId}`);

    socket.on("disconnect", (_reason) => {
      // Cleanup logic if needed (e.g., presence tracking)
    });
  });
}
