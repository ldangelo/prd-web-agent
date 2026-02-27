/**
 * /api/prds/[id]/refine - PRD refinement API route.
 *
 * POST - Load existing PRD content (latest version) for agent-assisted refinement.
 */
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// POST /api/prds/[id]/refine
// ---------------------------------------------------------------------------

export async function POST(
  _request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    await requireAuth();

    const prdId = context.params.id;

    // Load the PRD record
    const prd = await prisma.prd.findUnique({
      where: { id: prdId },
    });
    if (!prd) {
      throw new NotFoundError("PRD not found");
    }

    // Load the latest version content
    const latestVersion = await prisma.prdVersion.findFirst({
      where: { prdId },
      orderBy: { version: "desc" },
    });

    return apiSuccess({
      prdId: prd.id,
      currentVersion: prd.currentVersion,
      content: latestVersion?.content ?? "",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
