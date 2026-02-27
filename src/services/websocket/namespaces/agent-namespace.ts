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

  agentNs.on("connection", (socket: Socket) => {
    const userId = socket.handshake.auth?.userId;

    // Join a user-specific room for targeted broadcasts
    socket.join(`user:${userId}`);

    // ----- agent:start -----
    socket.on("agent:start", (_data) => {
      // Agent session start logic will be implemented in the agent service layer.
      // This handler will coordinate with the agent orchestrator.
    });

    // ----- agent:message -----
    socket.on("agent:message", (_data) => {
      // Message forwarding to the active agent session.
    });

    // ----- agent:resume -----
    socket.on("agent:resume", (_data) => {
      // Resume a previously paused or disconnected agent session.
    });

    // ----- disconnect -----
    socket.on("disconnect", (_reason) => {
      // Start an idle timer so the agent session can be reclaimed
      // if the user does not reconnect within the grace period.
    });
  });
}
