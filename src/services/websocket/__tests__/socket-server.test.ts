/**
 * WebSocket Server Service Tests
 *
 * Tests for the core WebSocketService that manages Socket.io server
 * lifecycle with Redis adapter support for multi-pod environments.
 */

import { Server as SocketServer } from "socket.io";

// Mock socket.io
jest.mock("socket.io", () => {
  const mockOn = jest.fn();
  const mockClose = jest.fn().mockImplementation((cb?: () => void) => {
    if (cb) cb();
  });
  const mockOf = jest.fn().mockReturnValue({
    on: jest.fn(),
    use: jest.fn(),
  });
  const mockAdapter = jest.fn();

  const MockServer = jest.fn().mockImplementation(() => ({
    on: mockOn,
    close: mockClose,
    of: mockOf,
    adapter: mockAdapter,
  }));

  return { Server: MockServer };
});

// Mock ioredis
jest.mock("ioredis", () => {
  const mockDuplicate = jest.fn().mockReturnValue({
    on: jest.fn(),
    disconnect: jest.fn(),
    status: "ready",
  });
  const MockRedis = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    disconnect: jest.fn(),
    duplicate: mockDuplicate,
    status: "ready",
  }));
  return { Redis: MockRedis };
});

// Mock redis adapter
jest.mock("@socket.io/redis-adapter", () => ({
  createAdapter: jest.fn().mockReturnValue("mock-adapter"),
}));

import { webSocketService, WebSocketService } from "../socket-server";

describe("WebSocketService", () => {
  let service: WebSocketService;
  const mockHttpServer = { listen: jest.fn() };

  beforeEach(() => {
    service = new WebSocketService();
  });

  afterEach(async () => {
    try {
      await service.shutdown();
    } catch {
      // Ignore shutdown errors in cleanup
    }
  });

  describe("initialize", () => {
    it("should create a SocketServer instance with default config", () => {
      const io = service.initialize(mockHttpServer);
      expect(io).toBeDefined();
      expect(SocketServer).toHaveBeenCalledWith(
        mockHttpServer,
        expect.objectContaining({
          cors: expect.objectContaining({
            origin: "http://localhost:3000",
          }),
        })
      );
    });

    it("should create a SocketServer instance with custom CORS origin", () => {
      const io = service.initialize(mockHttpServer, {
        corsOrigin: "https://example.com",
      });
      expect(io).toBeDefined();
      expect(SocketServer).toHaveBeenCalledWith(
        mockHttpServer,
        expect.objectContaining({
          cors: expect.objectContaining({
            origin: "https://example.com",
          }),
        })
      );
    });

    it("should configure Redis adapter when redisUrl is provided", () => {
      const { createAdapter } = require("@socket.io/redis-adapter");
      const { Redis } = require("ioredis");

      service.initialize(mockHttpServer, {
        redisUrl: "redis://localhost:6379",
      });

      expect(Redis).toHaveBeenCalledWith("redis://localhost:6379");
      expect(createAdapter).toHaveBeenCalled();
    });

    it("should not configure Redis adapter when redisUrl is not provided", () => {
      const { createAdapter } = require("@socket.io/redis-adapter");

      // Clear previous calls
      createAdapter.mockClear();

      service.initialize(mockHttpServer);

      expect(createAdapter).not.toHaveBeenCalled();
    });

    it("should throw if already initialized", () => {
      service.initialize(mockHttpServer);
      expect(() => service.initialize(mockHttpServer)).toThrow(
        "WebSocket server is already initialized"
      );
    });
  });

  describe("getIO", () => {
    it("should return the SocketServer instance after initialization", () => {
      const io = service.initialize(mockHttpServer);
      expect(service.getIO()).toBe(io);
    });

    it("should throw if not initialized", () => {
      expect(() => service.getIO()).toThrow(
        "WebSocket server is not initialized"
      );
    });
  });

  describe("shutdown", () => {
    it("should close the server and clean up resources", async () => {
      const io = service.initialize(mockHttpServer);
      await service.shutdown();

      expect(io.close).toHaveBeenCalled();
    });

    it("should allow re-initialization after shutdown", async () => {
      service.initialize(mockHttpServer);
      await service.shutdown();

      // Should not throw
      const io = service.initialize(mockHttpServer);
      expect(io).toBeDefined();
    });

    it("should be safe to call shutdown when not initialized", async () => {
      // Should not throw
      await expect(service.shutdown()).resolves.toBeUndefined();
    });

    it("should disconnect Redis clients on shutdown", async () => {
      service.initialize(mockHttpServer, {
        redisUrl: "redis://localhost:6379",
      });

      await service.shutdown();

      const { Redis } = require("ioredis");
      const redisInstance = Redis.mock.results[Redis.mock.results.length - 1].value;
      expect(redisInstance.disconnect).toHaveBeenCalled();
    });
  });

  describe("singleton export", () => {
    it("should export a singleton instance", () => {
      expect(webSocketService).toBeInstanceOf(WebSocketService);
    });
  });
});
