/**
 * Notification Namespace Tests
 *
 * Tests for the /notifications Socket.io namespace that handles
 * real-time notification delivery to authenticated users.
 */

// Mock socket.io before imports
const mockNamespaceUse = jest.fn();
const mockNamespaceOn = jest.fn();
const mockNamespace = {
  use: mockNamespaceUse,
  on: mockNamespaceOn,
};
const mockOf = jest.fn().mockReturnValue(mockNamespace);

jest.mock("socket.io", () => {
  const MockServer = jest.fn().mockImplementation(() => ({
    of: mockOf,
    on: jest.fn(),
    close: jest.fn(),
  }));
  return { Server: MockServer };
});

import { Server as SocketServer } from "socket.io";
import {
  registerNotificationNamespace,
  NotificationServerEvents,
} from "../namespaces/notification-namespace";

describe("Notification Namespace", () => {
  let io: SocketServer;

  beforeEach(() => {
    jest.clearAllMocks();
    io = new SocketServer();
  });

  describe("registerNotificationNamespace", () => {
    it("should register the /notifications namespace", () => {
      registerNotificationNamespace(io);

      expect(mockOf).toHaveBeenCalledWith("/notifications");
    });

    it("should attach authentication middleware", () => {
      registerNotificationNamespace(io);

      expect(mockNamespaceUse).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should register connection handler", () => {
      registerNotificationNamespace(io);

      expect(mockNamespaceOn).toHaveBeenCalledWith(
        "connection",
        expect.any(Function)
      );
    });
  });

  describe("NotificationServerEvents type definitions", () => {
    it("should define notification event structure", () => {
      const data: Parameters<NotificationServerEvents["notification"]>[0] = {
        id: "notif-123",
        type: "prd_updated",
        message: "Your PRD has been updated",
      };

      expect(data.id).toBe("notif-123");
      expect(data.type).toBe("prd_updated");
      expect(data.message).toBe("Your PRD has been updated");
    });

    it("should define notification event with optional prdId", () => {
      const data: Parameters<NotificationServerEvents["notification"]>[0] = {
        id: "notif-456",
        type: "prd_saved",
        message: "PRD saved successfully",
        prdId: "prd-789",
      };

      expect(data.prdId).toBe("prd-789");
    });
  });

  describe("connection handler behavior", () => {
    it("should join user room on connection", () => {
      registerNotificationNamespace(io);

      const connectionHandler = mockNamespaceOn.mock.calls.find(
        (call: any[]) => call[0] === "connection"
      )?.[1];

      expect(connectionHandler).toBeDefined();

      const mockSocket = {
        id: "socket-1",
        handshake: { auth: { userId: "user-123" } },
        on: jest.fn(),
        join: jest.fn(),
        data: {} as Record<string, any>,
      };

      connectionHandler(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith("user:user-123");
    });

    it("should register disconnect handler", () => {
      registerNotificationNamespace(io);

      const connectionHandler = mockNamespaceOn.mock.calls.find(
        (call: any[]) => call[0] === "connection"
      )?.[1];

      const mockSocket = {
        id: "socket-1",
        handshake: { auth: { userId: "user-456" } },
        on: jest.fn(),
        join: jest.fn(),
        data: {} as Record<string, any>,
      };

      connectionHandler(mockSocket);

      const registeredEvents = mockSocket.on.mock.calls.map(
        (call: any[]) => call[0]
      );
      expect(registeredEvents).toContain("disconnect");
    });
  });
});
