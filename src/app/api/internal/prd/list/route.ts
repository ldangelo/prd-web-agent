/**
 * GET /api/internal/prd/list
 *
 * Internal endpoint called by OpenClaw agent to list PRDs.
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
    const userId = searchParams.get("userId");
    const projectId = searchParams.get("projectId");
    const search = searchParams.get("search");

    if (!userId) {
      return apiError("Missing required param: userId", 400);
    }

    const where: any = { authorId: userId, isDeleted: false };

    if (projectId) {
      where.projectId = projectId;
    }

    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    const prds = await prisma.prd.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        currentVersion: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const formatted = prds.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      version: p.currentVersion,
      updatedAt: p.updatedAt,
    }));

    return apiSuccess({ prds: formatted });
  } catch (error) {
    logger.error({ error }, "Error in internal PRD list");
    return handleApiError(error);
  }
}
