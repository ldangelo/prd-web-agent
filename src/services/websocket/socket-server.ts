/**
 * WebSocket Server Service
 *
 * Manages the Socket.io server lifecycle with optional Redis adapter
 * for horizontal scaling across multiple pods/instances.
 *
 * Usage:
 *   import { webSocketService } from "@/services/websocket";
 *   webSocketService.initialize(httpServer, { redisUrl: "redis://..." });
 */

import { Server as SocketServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";

export interface SocketServerConfig {
  /** Redis URL for multi-pod pub/sub adapter. Omit for single-instance mode. */
  redisUrl?: string;
  /** Allowed CORS origin. Defaults to http://localhost:3000 */
  corsOrigin?: string;
}

export class WebSocketService {
  private io: SocketServer | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;

  /**
   * Initialize the Socket.io server and optionally attach the Redis adapter.
   *
   * @param httpServer - The Node.js HTTP server to bind to
   * @param config - Optional configuration for Redis and CORS
   * @returns The initialized SocketServer instance
   * @throws If the server is already initialized
   */
  initialize(httpServer: any, config?: SocketServerConfig): SocketServer {
    if (this.io) {
      throw new Error("WebSocket server is already initialized");
    }

    const corsOrigin = config?.corsOrigin ?? "http://localhost:3000";

    this.io = new SocketServer(httpServer, {
      cors: {
        origin: corsOrigin,
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    if (config?.redisUrl) {
      this.pubClient = new Redis(config.redisUrl);
      this.subClient = this.pubClient.duplicate();
      this.io.adapter(createAdapter(this.pubClient, this.subClient) as any);
    }

    return this.io;
  }

  /**
   * Get the current SocketServer instance.
   *
   * @returns The SocketServer instance
   * @throws If the server has not been initialized
   */
  getIO(): SocketServer {
    if (!this.io) {
      throw new Error("WebSocket server is not initialized");
    }
    return this.io;
  }

  /**
   * Gracefully shut down the WebSocket server and disconnect Redis clients.
   */
  async shutdown(): Promise<void> {
    if (!this.io) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.io!.close(() => resolve());
    });

    if (this.pubClient) {
      this.pubClient.disconnect();
    }
    if (this.subClient) {
      this.subClient.disconnect();
    }

    this.io = null;
    this.pubClient = null;
    this.subClient = null;
  }
}

/** Singleton instance for application-wide use. */
export const webSocketService = new WebSocketService();
