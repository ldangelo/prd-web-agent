/**
 * Background PRD generator service.
 *
 * Triggers the Ensemble `/create-prd` skill via a Pi SDK session.
 * The skill writes a markdown file to `docs/PRD/` in the repo clone
 * directory. After the skill completes, the server reads that file and
 * saves its contents as a `PrdVersion` in the database.
 *
 * Events are forwarded to the user via Socket.io for real-time streaming.
 */

import { AgentSessionManager } from "./agent-session-manager";
import { RepoCloneService } from "@/services/repo-clone-service";
import type { AgentSessionEvent } from "@/types/pi-sdk";
import { prisma } from "@/lib/prisma";
import { SearchService } from "@/services/search-service";
import logger from "@/lib/logger";
import * as fs from "fs/promises";
import * as path from "path";

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

const searchService = new SearchService();
const repoCloneService = new RepoCloneService();

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
    // 1. Get the repo clone ready
    // -----------------------------------------------------------------------
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: opts.projectId },
      select: { githubRepo: true },
    });

    if (!project.githubRepo) {
      throw new Error("Project has no GitHub repository configured");
    }

    // Fetch the user's GitHub OAuth token
    const account = await prisma.account.findFirst({
      where: { userId: opts.userId, provider: "github" },
      select: { access_token: true },
    });

    if (!account?.access_token) {
      throw new Error("No GitHub OAuth token found for user");
    }

    // Clone (or sync) the repository
    await repoCloneService.cloneRepo(
      opts.userId,
      opts.projectId,
      project.githubRepo,
      account.access_token,
    );

    const cloneDir = repoCloneService.getCloneDir(opts.userId, opts.projectId);
    const prdDir = path.join(cloneDir, "docs", "PRD");

    // -----------------------------------------------------------------------
    // 2. Snapshot existing docs/PRD/*.md files
    // -----------------------------------------------------------------------
    const snapshotFiles = await listMdFiles(prdDir);

    // -----------------------------------------------------------------------
    // 3. Create Pi SDK session with workingDir = cloneDir
    // -----------------------------------------------------------------------
    const { sessionId } = await manager.createSession({
      userId: opts.userId,
      mode: "create",
      projectId: opts.projectId,
      prdId: opts.prdId,
      description: opts.description,
      workingDir: cloneDir,
    });

    // -----------------------------------------------------------------------
    // 4. Subscribe to events for Socket.io forwarding
    // -----------------------------------------------------------------------
    let sessionEnded = false;
    const sessionEndPromise = new Promise<void>((resolve) => {
      manager.subscribe(sessionId, (event: AgentSessionEvent) => {
        forwardEvent(agentNs, opts.userId, opts.prdId, sessionId, event);

        // Detect when the agent session ends
        if (event.type === "message_end") {
          sessionEnded = true;
          resolve();
        }
        if (event.type === "error") {
          resolve();
        }
      });
    });

    // -----------------------------------------------------------------------
    // 5. Send prompt: invoke the /create-prd skill
    // -----------------------------------------------------------------------
    const prompt = `/create-prd\n\n${opts.description}`;

    await manager.prompt(sessionId, prompt);

    // Wait for session to end (with a timeout)
    await Promise.race([
      sessionEndPromise,
      new Promise<void>((resolve) => setTimeout(resolve, 10 * 60 * 1000)), // 10 min timeout
    ]);

    // -----------------------------------------------------------------------
    // 6. Diff docs/PRD/ to find the new file
    // -----------------------------------------------------------------------
    const currentFiles = await listMdFiles(prdDir);
    const newFiles = currentFiles.filter((f) => !snapshotFiles.includes(f));

    let prdContent: string | null = null;
    let prdFileName: string | null = null;

    if (newFiles.length > 0) {
      // Use the first new file found
      prdFileName = newFiles[0];
      prdContent = await fs.readFile(path.join(prdDir, prdFileName), "utf-8");
    } else if (currentFiles.length > 0) {
      // If no new files, check if any existing files were modified
      // (the skill may have overwritten an existing file)
      for (const file of currentFiles) {
        const filePath = path.join(prdDir, file);
        const stat = await fs.stat(filePath);
        // If modified within the last 15 minutes, consider it the output
        if (Date.now() - stat.mtimeMs < 15 * 60 * 1000) {
          prdFileName = file;
          prdContent = await fs.readFile(filePath, "utf-8");
          break;
        }
      }
    }

    if (!prdContent || !prdFileName) {
      throw new Error("Agent completed but no PRD file was found in docs/PRD/");
    }

    // -----------------------------------------------------------------------
    // 7. Save to database
    // -----------------------------------------------------------------------
    const title = extractTitleFromMarkdown(prdContent) ?? prdFileName.replace(/\.md$/, "");

    await prisma.$transaction(async (tx) => {
      await tx.prdVersion.create({
        data: {
          prdId: opts.prdId,
          version: 1,
          content: prdContent!,
          changeSummary: "Initial generation via /create-prd skill",
          authorId: opts.userId,
        },
      });
      await tx.prd.update({
        where: { id: opts.prdId },
        data: {
          title,
          currentVersion: 1,
          generationStatus: "completed",
          generationError: null,
        },
      });
    });

    // Update full-text search index
    await searchService.indexPrd({
      prdId: opts.prdId,
      title,
      content: prdContent,
      projectId: opts.projectId,
      authorId: opts.userId,
      status: "DRAFT",
      tags: [],
      version: 1,
    });

    // -----------------------------------------------------------------------
    // 8. Emit prd_saved event
    // -----------------------------------------------------------------------
    emitPrdSaved(agentNs, opts.userId, opts.prdId, 1);

    logger.info({ prdId: opts.prdId, sessionId, prdFileName }, "PRD generation finished");
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * List *.md files in a directory. Returns an empty array if the directory
 * does not exist.
 */
async function listMdFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
}

/**
 * Extract the first H1 heading from markdown content to use as the PRD title.
 */
function extractTitleFromMarkdown(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
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
