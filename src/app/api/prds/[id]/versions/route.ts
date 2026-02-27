/**
 * /api/prds/[id]/versions - PRD version history API route.
 *
 * GET - Returns chronological list of versions for a PRD.
 */
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// GET /api/prds/[id]/versions
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const prdId = context.params.id;

    // Verify the PRD exists
    const prd = await prisma.prd.findUnique({
      where: { id: prdId },
    });
    if (!prd) {
      throw new NotFoundError("PRD not found");
    }

    // Fetch all versions ordered chronologically
    const versions = await prisma.prdVersion.findMany({
      where: { prdId },
      orderBy: { version: "asc" },
      select: {
        id: true,
        version: true,
        authorId: true,
        changeSummary: true,
        createdAt: true,
      },
    });

    return apiSuccess(versions);
  } catch (error) {
    return handleApiError(error);
  }
}
