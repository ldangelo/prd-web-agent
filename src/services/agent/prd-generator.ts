/**
 * Background PRD generator service.
 *
 * Triggers PRD creation via an OpenClaw-backed agent session.
 * The agent generates the PRD content and saves it via the save_prd tool
 * or internal API callback. Events are forwarded to the user via Socket.io
 * for real-time streaming.
 */

import { AgentSessionManager } from "./agent-session-manager";
import type { AgentSessionEvent } from "@/types/pi-sdk";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { buildCreatePrompt } from "@/lib/prd/build-create-prompt";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriggerPrdGenerationOptions {
  prdId: string;
  projectId: string;
  userId: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Socket.io reference (set by the WebSocket bootstrap)
// ---------------------------------------------------------------------------

let _io: any = null;

/**
 * Set the Socket.io server instance for event forwarding.
 * Called once during server startup.
 */
export function setSocketServer(io: any): void {
  _io = io;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget: create an agent session that generates a full PRD.
 *
 * The function returns immediately. Generation happens in the background.
 * Progress is streamed to the user via Socket.io events.
 */
export function triggerPrdGeneration(opts: TriggerPrdGenerationOptions): void {
  // Run async work without awaiting — fire and forget
  runGeneration(opts).catch((err) => {
    logger.error(
      { err, prdId: opts.prdId },
      "Unhandled error in PRD generation",
    );
  });
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function runGeneration(opts: TriggerPrdGenerationOptions): Promise<void> {
  const manager = new AgentSessionManager();
  const agentNs = _io?.of("/agent");

  try {
    // Mark as generating
    await prisma.prd.update({
      where: { id: opts.prdId },
      data: { generationStatus: "generating" },
    });

    // -----------------------------------------------------------------------
    // 1. Create agent session with create-prd context
    // -----------------------------------------------------------------------
    const { sessionId } = await manager.createSession({
      userId: opts.userId,
      mode: "create",
      projectId: opts.projectId,
      prdId: opts.prdId,
      description: opts.description,
    });

    // -----------------------------------------------------------------------
    // 2. Subscribe to events for Socket.io forwarding
    // -----------------------------------------------------------------------
    let prdSaved = false;
    const sessionEndPromise = new Promise<void>((resolve) => {
      manager.subscribe(sessionId, (event: AgentSessionEvent) => {
        forwardEvent(agentNs, opts.userId, opts.prdId, sessionId, event);

        if (event.type === "message_end") {
          resolve();
        }
        if (event.type === "error") {
          resolve();
        }
      });
    });

    // -----------------------------------------------------------------------
    // 3. Send the description as the initial prompt
    // -----------------------------------------------------------------------
    const prompt = buildCreatePrompt(opts.description);

    // Collect the full response text
    let generatedContent = "";
    manager.subscribe(sessionId, (event: AgentSessionEvent) => {
      if (event.type === "text_delta" && typeof event.data === "string") {
        generatedContent += event.data;
      }
      if (event.type === "error") {
        logger.error({ event, sessionId }, "Agent event: error");
      }
    });

    logger.info({ sessionId, prdId: opts.prdId }, "Sending prompt to agent");
    await manager.prompt(sessionId, prompt);
    logger.info(
      { sessionId, prdId: opts.prdId, contentLength: generatedContent.length },
      "Agent prompt completed",
    );

    // Wait for session to end (with a timeout)
    await Promise.race([
      sessionEndPromise,
      new Promise<void>((resolve) => setTimeout(resolve, 10 * 60 * 1000)), // 10 min timeout
    ]);

    // -----------------------------------------------------------------------
    // 4. Save the generated content as a PrdVersion
    // -----------------------------------------------------------------------
    if (generatedContent.trim()) {
      // Extract a title from the first heading or use a truncated description
      const titleMatch = generatedContent.match(/^#\s+(.+)$/m);
      const title = titleMatch
        ? titleMatch[1].trim()
        : opts.description.slice(0, 120);

      const version = await prisma.prdVersion.create({
        data: {
          prdId: opts.prdId,
          version: 1,
          content: generatedContent,
          changeSummary: "Initial PRD generated by AI agent",
          authorId: opts.userId,
        },
      });

      await prisma.prd.update({
        where: { id: opts.prdId },
        data: {
          title,
          currentVersion: version.version,
          generationStatus: "completed",
          generationError: null,
        },
      });

      prdSaved = true;
      emitPrdSaved(agentNs, opts.userId, opts.prdId, version.version);
    }

    if (!prdSaved) {
      throw new Error(
        "Agent completed but produced no content.",
      );
    }

    logger.info({ prdId: opts.prdId, sessionId }, "PRD generation finished");
  } catch (err: any) {
    logger.error({ err, prdId: opts.prdId }, "PRD generation failed");

    await prisma.prd.update({
      where: { id: opts.prdId },
      data: {
        generationStatus: "failed",
        generationError: err.message ?? "Unknown error",
      },
    });

    emitError(agentNs, opts.userId, "unknown", err.message ?? "Generation failed");
  } finally {
    await manager.disposeAll();
  }
}

// ---------------------------------------------------------------------------
// Socket.io event forwarding
// ---------------------------------------------------------------------------

function forwardEvent(
  agentNs: any,
  userId: string,
  prdId: string,
  sessionId: string,
  event: AgentSessionEvent,
): void {
  if (!agentNs) return;

  const room = `user:${userId}`;

  switch (event.type) {
    case "text_delta":
      agentNs.to(room).emit("agent:text_delta", {
        sessionId,
        delta: typeof event.data === "string" ? event.data : String(event.data ?? ""),
        contentIndex: 0,
      });
      break;

    case "message_start":
      agentNs.to(room).emit("agent:message_start", { sessionId });
      break;

    case "message_end":
      agentNs.to(room).emit("agent:message_end", { sessionId });
      break;

    case "tool_start": {
      const toolData = event.data as { toolName?: string } | undefined;
      agentNs.to(room).emit("agent:tool_start", {
        sessionId,
        toolName: toolData?.toolName ?? "unknown",
      });
      break;
    }

    case "tool_end": {
      const toolEndData = event.data as { toolName?: string; isError?: boolean } | undefined;
      agentNs.to(room).emit("agent:tool_end", {
        sessionId,
        toolName: toolEndData?.toolName ?? "unknown",
        success: !(toolEndData?.isError ?? false),
      });
      break;
    }

    case "error":
      agentNs.to(room).emit("agent:error", {
        sessionId,
        error: typeof event.data === "string" ? event.data : "Agent error",
        retryable: true,
      });
      break;
  }
}

function emitPrdSaved(
  agentNs: any,
  userId: string,
  prdId: string,
  version: number,
): void {
  if (!agentNs) return;
  agentNs.to(`user:${userId}`).emit("agent:prd_saved", { prdId, version });
}

function emitError(
  agentNs: any,
  userId: string,
  sessionId: string,
  error: string,
): void {
  if (!agentNs) return;
  agentNs.to(`user:${userId}`).emit("agent:error", {
    sessionId,
    error,
    retryable: true,
  });
}
