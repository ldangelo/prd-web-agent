/**
 * POST /api/internal/prd/save
 *
 * Internal endpoint called by OpenClaw agent to save/update PRD content.
 * Authenticated via OPENCLAW_INTERNAL_TOKEN.
 */
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SearchService } from "@/services/search-service";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { validateInternalToken } from "../../auth";
import logger from "@/lib/logger";

const searchService = new SearchService();

export async function POST(request: NextRequest) {
  try {
    const authError = validateInternalToken(request);
    if (authError) return authError;

    const body = await request.json();
    const { title, content, changeSummary, userId, projectId, prdId } = body;

    if (!title || !content || !userId || !projectId) {
      return (await import("@/lib/api/response")).apiError(
        "Missing required fields: title, content, userId, projectId",
        400,
      );
    }

    let resultPrdId: string;
    let version: number;

    if (prdId) {
      // Update existing PRD with a new version
      const existing = await prisma.prd.findUnique({ where: { id: prdId } });
      if (!existing) {
        return (await import("@/lib/api/response")).apiError("PRD not found", 404);
      }

      const nextVersion = existing.currentVersion + 1;

      await prisma.$transaction(async (tx) => {
        await tx.prd.update({
          where: { id: prdId },
          data: { currentVersion: nextVersion, title },
        });
        await tx.prdVersion.create({
          data: {
            prdId,
            version: nextVersion,
            content,
            changeSummary: changeSummary ?? null,
            authorId: userId,
          },
        });
      });

      resultPrdId = prdId;
      version = nextVersion;
    } else {
      // Check if a PRD with the same title already exists
      const existing = await prisma.prd.findFirst({
        where: { title, projectId, authorId: userId, isDeleted: false },
      });

      if (existing) {
        const nextVersion = existing.currentVersion + 1;

        await prisma.$transaction(async (tx) => {
          await tx.prd.update({
            where: { id: existing.id },
            data: { currentVersion: nextVersion },
          });
          await tx.prdVersion.create({
            data: {
              prdId: existing.id,
              version: nextVersion,
              content,
              changeSummary: changeSummary ?? null,
              authorId: userId,
            },
          });
        });

        resultPrdId = existing.id;
        version = nextVersion;
      } else {
        const result = await prisma.$transaction(async (tx) => {
          const prd = await tx.prd.create({
            data: {
              title,
              projectId,
              authorId: userId,
              currentVersion: 1,
            },
          });
          await tx.prdVersion.create({
            data: {
              prdId: prd.id,
              version: 1,
              content,
              changeSummary: changeSummary ?? null,
              authorId: userId,
            },
          });
          return prd;
        });

        resultPrdId = result.id;
        version = 1;
      }
    }

    // Update search index
    await searchService.indexPrd({
      prdId: resultPrdId,
      title,
      content,
      projectId,
      authorId: userId,
      status: "DRAFT",
      tags: [],
      version,
    });

    logger.info({ prdId: resultPrdId, version }, "PRD saved via internal API");

    return apiSuccess({ prdId: resultPrdId, version });
  } catch (error) {
    logger.error({ error }, "Error in internal PRD save");
    return handleApiError(error);
  }
}
