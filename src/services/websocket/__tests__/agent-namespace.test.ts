/**
 * Agent Namespace Tests
 *
 * Tests for the /agent Socket.io namespace that handles
 * real-time agent interaction events (start, message, resume).
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
  registerAgentNamespace,
  AgentClientEvents,
  AgentServerEvents,
} from "../namespaces/agent-namespace";

describe("Agent Namespace", () => {
  let io: SocketServer;

  beforeEach(() => {
    jest.clearAllMocks();
    io = new SocketServer();
  });

  describe("registerAgentNamespace", () => {
    it("should register the /agent namespace", () => {
      registerAgentNamespace(io);

      expect(mockOf).toHaveBeenCalledWith("/agent");
    });

    it("should attach authentication middleware", () => {
      registerAgentNamespace(io);

      expect(mockNamespaceUse).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should register connection handler", () => {
      registerAgentNamespace(io);

      expect(mockNamespaceOn).toHaveBeenCalledWith(
        "connection",
        expect.any(Function)
      );
    });
  });

  describe("AgentClientEvents type definitions", () => {
    it("should define agent:start event structure", () => {
      // Type-level test: verify the event structure compiles correctly
      const startData: Parameters<AgentClientEvents["agent:start"]>[0] = {
        projectId: "proj-123",
        mode: "create",
      };

      expect(startData.projectId).toBe("proj-123");
      expect(startData.mode).toBe("create");
    });

    it("should define agent:start event with optional fields", () => {
      const startData: Parameters<AgentClientEvents["agent:start"]>[0] = {
        prdId: "prd-456",
        projectId: "proj-123",
        description: "A web app",
        mode: "refine",
      };

      expect(startData.prdId).toBe("prd-456");
      expect(startData.description).toBe("A web app");
      expect(startData.mode).toBe("refine");
    });

    it("should define agent:message event structure", () => {
      const messageData: Parameters<AgentClientEvents["agent:message"]>[0] = {
        sessionId: "sess-789",
        text: "Hello agent",
      };

      expect(messageData.sessionId).toBe("sess-789");
      expect(messageData.text).toBe("Hello agent");
    });

    it("should define agent:message event with optional images", () => {
      const messageData: Parameters<AgentClientEvents["agent:message"]>[0] = {
        sessionId: "sess-789",
        text: "Check this image",
        images: [{ url: "https://example.com/img.png" }],
      };

      expect(messageData.images).toHaveLength(1);
    });

    it("should define agent:resume event structure", () => {
      const resumeData: Parameters<AgentClientEvents["agent:resume"]>[0] = {
        sessionId: "sess-789",
      };

      expect(resumeData.sessionId).toBe("sess-789");
    });
  });

  describe("AgentServerEvents type definitions", () => {
    it("should define agent:text_delta event structure", () => {
      const deltaData: Parameters<AgentServerEvents["agent:text_delta"]>[0] = {
        sessionId: "sess-789",
        delta: "Hello",
        contentIndex: 0,
      };

      expect(deltaData.sessionId).toBe("sess-789");
      expect(deltaData.delta).toBe("Hello");
      expect(deltaData.contentIndex).toBe(0);
    });

    it("should define agent:message_start event structure", () => {
      const data: Parameters<AgentServerEvents["agent:message_start"]>[0] = {
        sessionId: "sess-789",
      };

      expect(data.sessionId).toBe("sess-789");
    });

    it("should define agent:message_end event structure", () => {
      const data: Parameters<AgentServerEvents["agent:message_end"]>[0] = {
        sessionId: "sess-789",
      };

      expect(data.sessionId).toBe("sess-789");
    });

    it("should define agent:tool_start event structure", () => {
      const data: Parameters<AgentServerEvents["agent:tool_start"]>[0] = {
        sessionId: "sess-789",
        toolName: "web_search",
      };

      expect(data.toolName).toBe("web_search");
    });

    it("should define agent:tool_end event structure", () => {
      const data: Parameters<AgentServerEvents["agent:tool_end"]>[0] = {
        sessionId: "sess-789",
        toolName: "web_search",
        success: true,
      };

      expect(data.success).toBe(true);
    });

    it("should define agent:prd_saved event structure", () => {
      const data: Parameters<AgentServerEvents["agent:prd_saved"]>[0] = {
        prdId: "prd-456",
        version: 2,
      };

      expect(data.prdId).toBe("prd-456");
      expect(data.version).toBe(2);
    });

    it("should define agent:error event structure", () => {
      const data: Parameters<AgentServerEvents["agent:error"]>[0] = {
        sessionId: "sess-789",
        error: "Something went wrong",
        retryable: true,
      };

      expect(data.error).toBe("Something went wrong");
      expect(data.retryable).toBe(true);
    });
  });

  describe("connection handler behavior", () => {
    it("should register event handlers on socket connection", () => {
      registerAgentNamespace(io);

      // Get the connection callback
      const connectionHandler = mockNamespaceOn.mock.calls.find(
        (call: any[]) => call[0] === "connection"
      )?.[1];

      expect(connectionHandler).toBeDefined();

      // Simulate a socket connection
      const mockSocket = {
        id: "socket-1",
        handshake: { auth: { userId: "user-123" } },
        on: jest.fn(),
        join: jest.fn(),
        data: {} as Record<string, any>,
      };

      connectionHandler(mockSocket);

      // Should join user-specific room
      expect(mockSocket.join).toHaveBeenCalledWith("user:user-123");

      // Should register event handlers
      const registeredEvents = mockSocket.on.mock.calls.map(
        (call: any[]) => call[0]
      );
      expect(registeredEvents).toContain("agent:start");
      expect(registeredEvents).toContain("agent:message");
      expect(registeredEvents).toContain("agent:resume");
      expect(registeredEvents).toContain("disconnect");
    });
  });
});
