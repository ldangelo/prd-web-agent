/**
 * /api/agent/chat - SSE streaming agent chat endpoint.
 *
 * POST - Create or reuse an agent session and stream the response as
 * Server-Sent Events. When the agent outputs a full revised PRD, it is
 * automatically saved as a new PrdVersion.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { AgentSessionManager } from "@/services/agent/agent-session-manager";
import { prisma } from "@/lib/prisma";
import type { AgentSessionEvent } from "@/types/pi-sdk";
import logger from "@/lib/logger";

// Keep one manager per server process for session reuse
const manager = new AgentSessionManager();

/**
 * Heuristic: does the agent response look like a full PRD document?
 * We check for multiple markdown headings that match typical PRD structure.
 */
function looksLikeFullPrd(text: string): boolean {
  const headingCount = (text.match(/^#{1,2}\s+.+$/gm) || []).length;
  // A full PRD typically has 5+ headings (Summary, Problem, Goals, Requirements, etc.)
  return headingCount >= 4 && text.length > 1500;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    const body = await request.json();
    const { prdId, text, sessionId: existingSessionId } = body as {
      prdId: string;
      text: string;
      sessionId?: string;
    };

    if (!prdId || !text) {
      return new Response(
        JSON.stringify({ error: "prdId and text are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Load PRD for context
    const prd = await prisma.prd.findUnique({ where: { id: prdId } });
    if (!prd) {
      return new Response(
        JSON.stringify({ error: "PRD not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // Load latest version content for refine context
    const latestVersion = await prisma.prdVersion.findFirst({
      where: { prdId },
      orderBy: { version: "desc" },
    });

    // Create or reuse session
    let sessionId = existingSessionId;
    if (!sessionId) {
      const result = await manager.createSession({
        userId,
        mode: "refine",
        projectId: prd.projectId,
        prdId,
        prdContent: latestVersion?.content ?? "",
      });
      sessionId = result.sessionId;
    }

    logger.info(
      { sessionId, prdId, userId, textLength: text.length },
      "Agent chat: starting SSE stream",
    );

    const currentVersion = latestVersion?.version ?? 0;

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        let fullText = "";

        function send(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        }

        // Send sessionId immediately so client can reuse it
        send("session", { sessionId });

        // Subscribe to agent events
        const unsubscribe = manager.subscribe(sessionId!, (event: AgentSessionEvent) => {
          switch (event.type) {
            case "message_start":
              send("message_start", {});
              break;
            case "text_delta": {
              const delta = typeof event.data === "string" ? event.data : String(event.data ?? "");
              fullText += delta;
              send("text_delta", { delta });
              break;
            }
            case "message_end":
              send("message_end", {});
              // Check if the response is a full PRD and save it
              savePrdIfNeeded(fullText, prdId, userId, currentVersion, text)
                .then((saved) => {
                  if (saved) {
                    send("prd_saved", { prdId, version: saved.version });
                  }
                })
                .catch((err) => {
                  logger.error({ err, prdId }, "Failed to save PRD version from chat");
                })
                .finally(() => {
                  unsubscribe();
                  controller.close();
                });
              break;
            case "error":
              send("error", {
                error: typeof event.data === "string" ? event.data : "Agent error",
              });
              unsubscribe();
              controller.close();
              break;
          }
        });

        // Send the prompt
        manager.prompt(sessionId!, text).catch((err) => {
          logger.error({ err, sessionId }, "Agent chat: prompt error");
          send("error", { error: err.message ?? "Prompt failed" });
          unsubscribe();
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, "Agent chat: request error");
    return new Response(
      JSON.stringify({ error: error.message ?? "Internal error" }),
      { status: error.statusCode ?? 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

/**
 * If the agent response looks like a full revised PRD, save it as a new version.
 */
async function savePrdIfNeeded(
  responseText: string,
  prdId: string,
  userId: string,
  currentVersion: number,
  userPrompt: string,
): Promise<{ version: number } | null> {
  if (!looksLikeFullPrd(responseText)) {
    logger.info(
      { prdId, responseLength: responseText.length },
      "Agent chat: response is conversational, not saving as version",
    );
    return null;
  }

  const newVersion = currentVersion + 1;
  const changeSummary = `Refined via chat: "${userPrompt.slice(0, 100)}"`;

  const version = await prisma.prdVersion.create({
    data: {
      prdId,
      version: newVersion,
      content: responseText,
      changeSummary,
      authorId: userId,
    },
  });

  // Extract title from first heading
  const titleMatch = responseText.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : undefined;

  await prisma.prd.update({
    where: { id: prdId },
    data: {
      currentVersion: newVersion,
      ...(title ? { title } : {}),
    },
  });

  logger.info(
    { prdId, version: newVersion, contentLength: responseText.length },
    "Agent chat: saved new PRD version from refinement",
  );

  return { version: newVersion };
}
