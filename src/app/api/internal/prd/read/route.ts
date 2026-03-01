/**
 * GET /api/internal/prd/read
 *
 * Internal endpoint called by OpenClaw agent to read PRD content.
 * Authenticated via OPENCLAW_INTERNAL_TOKEN.
 */
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { validateInternalToken } from "../../auth";
import logger from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const authError = validateInternalToken(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get("identifier");
    const userId = searchParams.get("userId");

    if (!identifier || !userId) {
      return apiError("Missing required params: identifier, userId", 400);
    }

    const prd = await prisma.prd.findFirst({
      where: {
        authorId: userId,
        OR: [{ id: identifier }, { title: identifier }],
      },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!prd) {
      return apiError(`PRD not found: "${identifier}"`, 404);
    }

    const latestVersion = prd.versions[0];

    return apiSuccess({
      id: prd.id,
      title: prd.title,
      status: prd.status,
      version: prd.currentVersion,
      content: latestVersion?.content ?? "",
      changeSummary: latestVersion?.changeSummary ?? null,
    });
  } catch (error) {
    logger.error({ error }, "Error in internal PRD read");
    return handleApiError(error);
  }
}
