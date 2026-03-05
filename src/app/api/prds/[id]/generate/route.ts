/**
 * /api/prds/[id]/generate - SSE streaming PRD generation endpoint.
 *
 * POST - Generate a PRD via an agent session and stream progress as
 * Server-Sent Events. Saves the generated content as a PrdVersion when
 * generation completes.
 *
 * This endpoint solves the race condition in the original create flow where
 * Socket.io events were emitted before the client had connected to the socket.
 * The caller creates the PRD via POST /api/prds, then immediately opens this
 * SSE stream to receive live generation progress.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { AgentSessionManager } from "@/services/agent/agent-session-manager";
import { prisma } from "@/lib/prisma";
import type { AgentSessionEvent } from "@/types/pi-sdk";
import { handleApiError, NotFoundError, ForbiddenError } from "@/lib/api/errors";
import logger from "@/lib/logger";
import { buildCreatePrompt } from "@/lib/prd/build-create-prompt";
import { ensureRepoClone } from "@/app/api/internal/repo/_lib/ensure-clone";

// ---------------------------------------------------------------------------
// POST /api/prds/[id]/generate
// ---------------------------------------------------------------------------

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const { id: prdId } = await params;

    // Load the PRD record
    const prd = await prisma.prd.findUnique({ where: { id: prdId } });
    if (!prd) {
      throw new NotFoundError("PRD not found");
    }

    // Verify the PRD belongs to a project the user is a member of
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: prd.projectId,
          userId,
        },
      },
    });
    if (!membership) {
      throw new ForbiddenError("User is not a member of this project");
    }

    // Ensure repo is cloned before building the prompt (non-fatal: generation continues without it)
    const repoResult = await ensureRepoClone(userId, prd.projectId);
    if (repoResult instanceof Response) {
      logger.warn({ userId, projectId: prd.projectId, prdId }, "PRD generate: repo clone unavailable, proceeding without repo context");
    }

    // Fix 3: Idempotency guard — return 409 if already generating or completed
    if (prd.generationStatus === "generating" || prd.generationStatus === "completed") {
      return new Response(
        JSON.stringify({ error: `PRD generation is already ${prd.generationStatus}` }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }

    // Mark the PRD as generating
    await prisma.prd.update({
      where: { id: prdId },
      data: { generationStatus: "generating" },
    });

    // Create a fresh AgentSessionManager for this request
    const manager = new AgentSessionManager();

    // Create the agent session in "create" mode
    const { sessionId } = await manager.createSession({
      userId,
      mode: "create",
      projectId: prd.projectId,
      prdId: prd.id,
      description: prd.description ?? prd.title,
    });

    // Use shared prompt helper — prefer the stored description; fall back to title
    const prompt = buildCreatePrompt(prd.description ?? prd.title, {
      userId,
      projectId: prd.projectId,
    });

    logger.info(
      { sessionId, prdId, userId },
      "PRD generate: starting SSE stream",
    );

    // Fix 4: Capture unsubscribe outside start() so cancel() can access it
    let unsubscribeFn: (() => void) | null = null;
    let streamClosed = false;

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        let generatedContent = "";
        // streamClosed is now in outer scope
        function closeStream() {
          if (!streamClosed) {
            streamClosed = true;
            controller.close();
          }
        }

        function send(event: string, data: unknown) {
          if (streamClosed) return;
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        }

        // Send sessionId immediately so the client can track the session
        send("session", { sessionId });

        // Subscribe to agent events
        const unsubscribe = manager.subscribe(sessionId, (event: AgentSessionEvent) => {
          switch (event.type) {
            case "message_start":
              send("message_start", {});
              break;

            case "text_delta": {
              const delta = typeof event.data === "string" ? event.data : String(event.data ?? "");
              generatedContent += delta;
              send("text_delta", { delta });
              break;
            }

            case "message_end":
              send("message_end", {});
              // Save the generated content and finalise the PRD record
              saveGeneratedPrd(generatedContent, prdId, userId, prd.title)
                .then((saved) => {
                  if (saved) {
                    send("prd_saved", { prdId, version: saved.version });
                  } else {
                    send("error", { error: "Agent completed but produced no content" });
                  }
                })
                .catch((err) => {
                  logger.error({ err, prdId }, "PRD generate: failed to save PRD version");
                  send("error", { error: "Failed to save generated PRD" });
                })
                .finally(() => {
                  manager.disposeAll().catch((err) => {
                    logger.warn({ err, sessionId }, "PRD generate: error disposing session");
                  });
                  unsubscribe();
                  closeStream();
                });
              break;

            case "error": {
              const errorMsg = typeof event.data === "string" ? event.data : "Agent error";
              logger.error({ prdId, sessionId, errorMsg }, "PRD generate: agent error event");

              // Mark the PRD as failed
              prisma.prd
                .update({
                  where: { id: prdId },
                  data: {
                    generationStatus: "failed",
                    generationError: errorMsg,
                  },
                })
                .catch((dbErr) => {
                  logger.error({ dbErr, prdId }, "PRD generate: failed to mark PRD as failed");
                });

              send("error", { error: errorMsg });
              // Fix 1: dispose session on error path
              manager.disposeAll().catch((err) => {
                logger.warn({ err, sessionId }, "PRD generate: error disposing session after agent error");
              });
              unsubscribe();
              closeStream();
              break;
            }
          }
        });

        // Keep a reference so cancel() can clean up on client disconnect
        unsubscribeFn = unsubscribe;

        // Send the prompt to start generation
        manager.prompt(sessionId, prompt).catch((err) => {
          logger.error({ err, sessionId, prdId }, "PRD generate: prompt error");

          prisma.prd
            .update({
              where: { id: prdId },
              data: {
                generationStatus: "failed",
                generationError: err.message ?? "Prompt failed",
              },
            })
            .catch((dbErr) => {
              logger.error({ dbErr, prdId }, "PRD generate: failed to mark PRD as failed after prompt error");
            });

          send("error", { error: err.message ?? "Prompt failed" });
          // Fix 1: dispose session on prompt rejection path
          manager.disposeAll().catch((disposeErr) => {
            logger.warn({ err: disposeErr, sessionId }, "PRD generate: error disposing session after prompt error");
          });
          unsubscribe();
          closeStream();
        });
      },

      // Fix 4: Clean up when the client disconnects or navigates away
      cancel() {
        if (streamClosed) return; // stream already completed successfully — don't overwrite
        logger.info({ sessionId, prdId }, "PRD generate: client disconnected, cleaning up");
        unsubscribeFn?.();
        prisma.prd
          .update({
            where: { id: prdId },
            data: { generationStatus: "failed", generationError: "Generation cancelled by client" },
          })
          .catch((err) => {
            logger.warn({ err, prdId }, "PRD generate: failed to mark PRD as failed after client disconnect");
          });
        manager.disposeAll().catch((err) => {
          logger.warn({ err, sessionId }, "PRD generate: error disposing session after client disconnect");
        });
        // TODO: manager.prompt() is fire-and-forget; the underlying LLM call has no
        // cancellation mechanism and will continue consuming resources until completion.
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "PRD generate: request error");
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Persist the generated PRD content as the next version, update the PRD
 * record's title (extracted from the first heading), currentVersion, and
 * generationStatus.
 */
async function saveGeneratedPrd(
  generatedContent: string,
  prdId: string,
  userId: string,
  fallbackTitle: string,
): Promise<{ version: number } | null> {
  if (!generatedContent.trim()) {
    logger.warn({ prdId }, "PRD generate: agent produced no content, skipping save");

    await prisma.prd.update({
      where: { id: prdId },
      data: {
        generationStatus: "failed",
        generationError: "Agent completed but produced no content.",
      },
    });

    return null;
  }

  // Extract a title from the first heading, fall back to the original title
  const titleMatch = generatedContent.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : fallbackTitle.slice(0, 120);

  // Fix 2: Query the latest existing version so we never hardcode version: 1
  const latestVersion = await prisma.prdVersion.findFirst({
    where: { prdId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latestVersion?.version ?? 0) + 1;

  const version = await prisma.prdVersion.create({
    data: {
      prdId,
      version: nextVersion,
      content: generatedContent,
      changeSummary: "Initial PRD generated by AI agent",
      authorId: userId,
    },
  });

  await prisma.prd.update({
    where: { id: prdId },
    data: {
      title,
      currentVersion: version.version,
      generationStatus: "completed",
      generationError: null,
    },
  });

  logger.info(
    { prdId, version: version.version, contentLength: generatedContent.length },
    "PRD generate: saved new PRD version",
  );

  return { version: version.version };
}
