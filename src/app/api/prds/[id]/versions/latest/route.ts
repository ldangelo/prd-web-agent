/**
 * GET /api/prds/[id]/versions/latest
 *
 * Returns the latest version of a PRD along with its generation status.
 * Used by the PRD detail page to fetch content and check generation state.
 */
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireAuth();

    const prdId = params.id;

    const prd = await prisma.prd.findUnique({
      where: { id: prdId },
      select: {
        id: true,
        title: true,
        status: true,
        generationStatus: true,
        generationError: true,
        currentVersion: true,
      },
    });

    if (!prd) {
      throw new NotFoundError("PRD not found");
    }

    const latestVersion = await prisma.prdVersion.findFirst({
      where: { prdId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        content: true,
        changeSummary: true,
        createdAt: true,
      },
    });

    return apiSuccess({
      prd: {
        id: prd.id,
        title: prd.title,
        status: prd.status,
        generationStatus: prd.generationStatus,
        generationError: prd.generationError,
        currentVersion: prd.currentVersion,
      },
      version: latestVersion,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
