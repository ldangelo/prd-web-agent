/**
 * Agent Namespace — /agent
 *
 * Handles real-time bidirectional communication for the AI agent workflow.
 * Clients emit events to start sessions, send messages, and resume sessions.
 * The server streams back text deltas, tool usage notifications, and errors.
 *
 * Socket.io v4 typed events pattern is used throughout.
 */

import { Server as SocketServer, Socket } from "socket.io";
import { AgentSessionManager } from "@/services/agent/agent-session-manager";
import type { AgentSessionEvent } from "@/types/pi-sdk";
import logger from "@/lib/logger";

// ---------------------------------------------------------------------------
// Shared session manager
// ---------------------------------------------------------------------------

const sessionManager = new AgentSessionManager();

// ---------------------------------------------------------------------------
// Client -> Server events
// ---------------------------------------------------------------------------

export interface AgentClientEvents {
  "agent:start": (data: {
    prdId?: string;
    projectId: string;
    description?: string;
    mode: "create" | "refine";
  }) => void;

  "agent:message": (data: {
    sessionId: string;
    text: string;
    images?: any[];
  }) => void;

  "agent:resume": (data: { sessionId: string }) => void;
}

// ---------------------------------------------------------------------------
// Server -> Client events
// ---------------------------------------------------------------------------

export interface AgentServerEvents {
  "agent:text_delta": (data: {
    sessionId: string;
    delta: string;
    contentIndex: number;
  }) => void;

  "agent:message_start": (data: { sessionId: string }) => void;

  "agent:message_end": (data: { sessionId: string }) => void;

  "agent:tool_start": (data: {
    sessionId: string;
    toolName: string;
  }) => void;

  "agent:tool_end": (data: {
    sessionId: string;
    toolName: string;
    success: boolean;
  }) => void;

  "agent:prd_saved": (data: { prdId: string; version: number }) => void;

  "agent:error": (data: {
    sessionId: string;
    error: string;
    retryable: boolean;
  }) => void;
}

// ---------------------------------------------------------------------------
// Authentication middleware
// ---------------------------------------------------------------------------

/**
 * Middleware that verifies the JWT/token from the socket handshake.
 * For now this validates that a userId is present in the auth payload.
 * Full JWT verification will be integrated when the custom server is wired up.
 */
function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): void {
  const userId = socket.handshake.auth?.userId;

  if (!userId) {
    return next(new Error("Authentication required: userId missing"));
  }

  // Attach userId to socket data for downstream handlers
  socket.data.userId = userId;
  next();
}

// ---------------------------------------------------------------------------
// Event forwarding helper
// ---------------------------------------------------------------------------

function wireEventForwarding(
  socket: Socket,
  sessionId: string,
): () => void {
  return sessionManager.subscribe(sessionId, (event: AgentSessionEvent) => {
    switch (event.type) {
      case "text_delta":
        socket.emit("agent:text_delta", {
          sessionId,
          delta: typeof event.data === "string" ? event.data : String(event.data ?? ""),
          contentIndex: 0,
        });
        break;

      case "message_start":
        socket.emit("agent:message_start", { sessionId });
        break;

      case "message_end":
        socket.emit("agent:message_end", { sessionId });
        break;

      case "tool_start": {
        const toolData = event.data as { toolName?: string } | undefined;
        socket.emit("agent:tool_start", {
          sessionId,
          toolName: toolData?.toolName ?? "unknown",
        });
        break;
      }

      case "tool_end": {
        const toolEndData = event.data as { toolName?: string; isError?: boolean } | undefined;
        socket.emit("agent:tool_end", {
          sessionId,
          toolName: toolEndData?.toolName ?? "unknown",
          success: !(toolEndData?.isError ?? false),
        });
        break;
      }

      case "error":
        socket.emit("agent:error", {
          sessionId,
          error: typeof event.data === "string" ? event.data : "Agent error",
          retryable: true,
        });
        break;
    }
  });
}

// ---------------------------------------------------------------------------
// Namespace registration
// ---------------------------------------------------------------------------

/**
 * Register the /agent namespace on the given Socket.io server.
 *
 * Sets up:
 *  - Authentication middleware
 *  - User room joining on connect
 *  - Event handlers for agent:start, agent:message, agent:resume
 *  - Idle timer on disconnect
 */
export function registerAgentNamespace(io: SocketServer): void {
  const agentNs = io.of("/agent");

  agentNs.use(authMiddleware);

  // Track active unsubscribe functions per socket
  const unsubscribes = new Map<string, () => void>();

  agentNs.on("connection", (socket: Socket) => {
    const userId = socket.handshake.auth?.userId;

    // Join a user-specific room for targeted broadcasts
    socket.join(`user:${userId}`);

    // ----- agent:start -----
    socket.on("agent:start", async (data) => {
      try {
        const { sessionId } = await sessionManager.createSession({
          userId,
          mode: data.mode,
          projectId: data.projectId,
          prdId: data.prdId,
          description: data.description,
        });

        // Wire up event forwarding from the agent session to this socket
        const unsub = wireEventForwarding(socket, sessionId);
        unsubscribes.set(socket.id, unsub);

        socket.emit("agent:message_start", { sessionId });
      } catch (err: any) {
        logger.error({ err, userId }, "Failed to start agent session");
        socket.emit("agent:error", {
          sessionId: "unknown",
          error: err.message ?? "Failed to start session",
          retryable: true,
        });
      }
    });

    // ----- agent:message -----
    socket.on("agent:message", async (data) => {
      try {
        await sessionManager.prompt(data.sessionId, data.text, data.images);
      } catch (err: any) {
        logger.error({ err, sessionId: data.sessionId }, "Failed to send agent message");
        socket.emit("agent:error", {
          sessionId: data.sessionId,
          error: err.message ?? "Failed to send message",
          retryable: true,
        });
      }
    });

    // ----- agent:resume -----
    socket.on("agent:resume", async (data) => {
      try {
        await sessionManager.resumeSession(data.sessionId, userId);

        const unsub = wireEventForwarding(socket, data.sessionId);
        unsubscribes.set(socket.id, unsub);
      } catch (err: any) {
        logger.error({ err, sessionId: data.sessionId }, "Failed to resume agent session");
        socket.emit("agent:error", {
          sessionId: data.sessionId,
          error: err.message ?? "Failed to resume session",
          retryable: true,
        });
      }
    });

    // ----- disconnect -----
    socket.on("disconnect", (_reason) => {
      // Clean up event subscription
      const unsub = unsubscribes.get(socket.id);
      if (unsub) {
        unsub();
        unsubscribes.delete(socket.id);
      }
    });
  });
}
