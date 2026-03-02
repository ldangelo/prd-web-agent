/**
 * Socket.io initialization endpoint (Pages Router API route).
 *
 * This endpoint lazily initializes the Socket.io server the first time it
 * is called. Subsequent calls are no-ops. Using the Pages Router API route
 * is the standard approach for attaching Socket.io to a Next.js server
 * without a custom server, since it provides access to `res.socket.server`
 * (the underlying Node.js HTTP server).
 *
 * The client calls this endpoint once before connecting to Socket.io to
 * ensure the server-side socket infrastructure is ready.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { Server as SocketIOServer } from "socket.io";
import { registerAgentNamespace } from "@/services/websocket";
import { setSocketServer } from "@/services/agent/prd-generator";

export const config = {
  api: { bodyParser: false },
};

export default function SocketHandler(
  _req: NextApiRequest,
  res: NextApiResponse,
): void {
  // Access the underlying Node.js HTTP server via the response socket
  const srv = (res.socket as any)?.server;

  if (!srv) {
    res.status(500).json({ error: "Server not available" });
    return;
  }

  // Idempotent: only initialize once
  if (!srv.io) {
    const io = new SocketIOServer(srv, {
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    // Store the io instance on the server to prevent re-initialization
    srv.io = io;

    // Register the /agent namespace for real-time agent communication
    registerAgentNamespace(io);

    // Wire the prd-generator so it can emit events to connected clients
    setSocketServer(io);
  }

  res.end();
}
