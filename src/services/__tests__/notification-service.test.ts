/**
 * Notification Service tests.
 *
 * Tests for createNotification, getUserNotifications, markAsRead,
 * markAllAsRead, and getUnreadCount. Prisma and Socket.io are mocked.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockNotificationCreate = jest.fn();
const mockNotificationFindUnique = jest.fn();
const mockNotificationFindMany = jest.fn();
const mockNotificationUpdate = jest.fn();
const mockNotificationUpdateMany = jest.fn();
const mockNotificationCount = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      create: (...args: unknown[]) => mockNotificationCreate(...args),
      findUnique: (...args: unknown[]) => mockNotificationFindUnique(...args),
      findMany: (...args: unknown[]) => mockNotificationFindMany(...args),
      update: (...args: unknown[]) => mockNotificationUpdate(...args),
      updateMany: (...args: unknown[]) => mockNotificationUpdateMany(...args),
      count: (...args: unknown[]) => mockNotificationCount(...args),
    },
  },
}));

// Mock the websocket service to prevent real Socket.io calls
const mockEmit = jest.fn();
const mockTo = jest.fn(() => ({ emit: mockEmit }));
const mockOf = jest.fn(() => ({ to: mockTo }));

jest.mock("@/services/websocket", () => ({
  webSocketService: {
    getIO: () => ({
      of: mockOf,
    }),
  },
}));

jest.mock("@/lib/logger", () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from "../notification-service";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_NOTIFICATION = {
  id: "notif_001",
  userId: "user_001",
  type: "comment",
  message: "Someone commented on your PRD",
  prdId: "prd_001",
  read: false,
  createdAt: new Date("2026-01-01"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NotificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createNotification", () => {
    it("should create a notification and push via Socket.io", async () => {
      mockNotificationCreate.mockResolvedValue(MOCK_NOTIFICATION);

      const result = await createNotification(
        "user_001",
        "comment",
        "Someone commented on your PRD",
        "prd_001",
      );

      expect(result).toEqual(MOCK_NOTIFICATION);
      expect(mockNotificationCreate).toHaveBeenCalledWith({
        data: {
          userId: "user_001",
          type: "comment",
          message: "Someone commented on your PRD",
          prdId: "prd_001",
        },
      });

      // Verify Socket.io push was attempted
      expect(mockOf).toHaveBeenCalledWith("/notifications");
      expect(mockTo).toHaveBeenCalledWith("user:user_001");
      expect(mockEmit).toHaveBeenCalledWith("notification", {
        id: "notif_001",
        type: "comment",
        message: "Someone commented on your PRD",
        prdId: "prd_001",
      });
    });

    it("should create a notification without prdId", async () => {
      const notif = { ...MOCK_NOTIFICATION, prdId: null };
      mockNotificationCreate.mockResolvedValue(notif);

      const result = await createNotification(
        "user_001",
        "comment",
        "A general notification",
      );

      expect(result).toEqual(notif);
      expect(mockNotificationCreate).toHaveBeenCalledWith({
        data: {
          userId: "user_001",
          type: "comment",
          message: "A general notification",
          prdId: null,
        },
      });
    });

    it("should not throw if Socket.io push fails", async () => {
      mockNotificationCreate.mockResolvedValue(MOCK_NOTIFICATION);
      mockOf.mockImplementationOnce(() => {
        throw new Error("Socket.io not initialized");
      });

      // Should still resolve without throwing
      const result = await createNotification(
        "user_001",
        "comment",
        "Test",
        "prd_001",
      );

      expect(result).toEqual(MOCK_NOTIFICATION);
    });
  });

  describe("getUserNotifications", () => {
    it("should return all notifications for a user", async () => {
      mockNotificationFindMany.mockResolvedValue([MOCK_NOTIFICATION]);

      const result = await getUserNotifications("user_001");

      expect(result).toEqual([MOCK_NOTIFICATION]);
      expect(mockNotificationFindMany).toHaveBeenCalledWith({
        where: { userId: "user_001" },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter to unread only when requested", async () => {
      mockNotificationFindMany.mockResolvedValue([MOCK_NOTIFICATION]);

      await getUserNotifications("user_001", true);

      expect(mockNotificationFindMany).toHaveBeenCalledWith({
        where: { userId: "user_001", read: false },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("markAsRead", () => {
    it("should mark a notification as read", async () => {
      mockNotificationFindUnique.mockResolvedValue(MOCK_NOTIFICATION);
      mockNotificationUpdate.mockResolvedValue({
        ...MOCK_NOTIFICATION,
        read: true,
      });

      const result = await markAsRead("notif_001", "user_001");

      expect(result).toHaveProperty("read", true);
      expect(mockNotificationUpdate).toHaveBeenCalledWith({
        where: { id: "notif_001" },
        data: { read: true },
      });
    });

    it("should return null if notification does not exist", async () => {
      mockNotificationFindUnique.mockResolvedValue(null);

      const result = await markAsRead("notif_999", "user_001");

      expect(result).toBeNull();
      expect(mockNotificationUpdate).not.toHaveBeenCalled();
    });

    it("should return null if notification belongs to another user", async () => {
      mockNotificationFindUnique.mockResolvedValue(MOCK_NOTIFICATION);

      const result = await markAsRead("notif_001", "user_other");

      expect(result).toBeNull();
      expect(mockNotificationUpdate).not.toHaveBeenCalled();
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all unread notifications as read", async () => {
      mockNotificationUpdateMany.mockResolvedValue({ count: 3 });

      const result = await markAllAsRead("user_001");

      expect(result).toBe(3);
      expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
        where: { userId: "user_001", read: false },
        data: { read: true },
      });
    });
  });

  describe("getUnreadCount", () => {
    it("should return the count of unread notifications", async () => {
      mockNotificationCount.mockResolvedValue(5);

      const result = await getUnreadCount("user_001");

      expect(result).toBe(5);
      expect(mockNotificationCount).toHaveBeenCalledWith({
        where: { userId: "user_001", read: false },
      });
    });
  });
});
