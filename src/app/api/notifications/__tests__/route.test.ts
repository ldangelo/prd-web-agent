/**
 * Notifications API route tests.
 *
 * Tests for GET /api/notifications, PUT /api/notifications/[id]/read,
 * and PUT /api/notifications/read-all.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockRequireAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
}));

const mockGetUserNotifications = jest.fn();
const mockMarkAsRead = jest.fn();
const mockMarkAllAsRead = jest.fn();
jest.mock("@/services/notification-service", () => ({
  getUserNotifications: (...args: unknown[]) => mockGetUserNotifications(...args),
  markAsRead: (...args: unknown[]) => mockMarkAsRead(...args),
  markAllAsRead: (...args: unknown[]) => mockMarkAllAsRead(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET } from "../route";
import { PUT as PutRead } from "../[id]/read/route";
import { PUT as PutReadAll } from "../read-all/route";
import { UnauthorizedError } from "@/lib/api/errors";

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
  createdAt: "2026-01-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// Tests: GET /api/notifications
// ---------------------------------------------------------------------------

describe("GET /api/notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_001", email: "user@test.com", role: "AUTHOR" },
    });
    mockGetUserNotifications.mockResolvedValue([MOCK_NOTIFICATION]);
  });

  it("should return notifications with 200", async () => {
    const response = await GET(
      new Request("http://localhost/api/notifications") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toHaveProperty("id", "notif_001");
    expect(mockGetUserNotifications).toHaveBeenCalledWith("user_001", false);
  });

  it("should pass unread=true filter", async () => {
    const response = await GET(
      new Request("http://localhost/api/notifications?unread=true") as any,
    );

    expect(response.status).toBe(200);
    expect(mockGetUserNotifications).toHaveBeenCalledWith("user_001", true);
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await GET(
      new Request("http://localhost/api/notifications") as any,
    );

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests: PUT /api/notifications/[id]/read
// ---------------------------------------------------------------------------

describe("PUT /api/notifications/[id]/read", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_001", email: "user@test.com", role: "AUTHOR" },
    });
    mockMarkAsRead.mockResolvedValue({ ...MOCK_NOTIFICATION, read: true });
  });

  it("should mark notification as read and return 200", async () => {
    const response = await PutRead(
      new Request("http://localhost/api/notifications/notif_001/read", {
        method: "PUT",
      }) as any,
      makeParams("notif_001") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("read", true);
    expect(mockMarkAsRead).toHaveBeenCalledWith("notif_001", "user_001");
  });

  it("should return 404 when notification not found", async () => {
    mockMarkAsRead.mockResolvedValue(null);

    const response = await PutRead(
      new Request("http://localhost/api/notifications/notif_999/read", {
        method: "PUT",
      }) as any,
      makeParams("notif_999") as any,
    );

    expect(response.status).toBe(404);
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await PutRead(
      new Request("http://localhost/api/notifications/notif_001/read", {
        method: "PUT",
      }) as any,
      makeParams("notif_001") as any,
    );

    expect(response.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests: PUT /api/notifications/read-all
// ---------------------------------------------------------------------------

describe("PUT /api/notifications/read-all", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_001", email: "user@test.com", role: "AUTHOR" },
    });
    mockMarkAllAsRead.mockResolvedValue(5);
  });

  it("should mark all as read and return count", async () => {
    const response = await PutReadAll(
      new Request("http://localhost/api/notifications/read-all", {
        method: "PUT",
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty("markedAsRead", 5);
    expect(mockMarkAllAsRead).toHaveBeenCalledWith("user_001");
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const response = await PutReadAll(
      new Request("http://localhost/api/notifications/read-all", {
        method: "PUT",
      }) as any,
    );

    expect(response.status).toBe(401);
  });
});
