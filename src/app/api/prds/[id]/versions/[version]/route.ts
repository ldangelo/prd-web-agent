/**
 * /api/prds/[id]/versions/[version] - Specific PRD version API route.
 *
 * GET - Returns the content of a specific version.
 */
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// GET /api/prds/[id]/versions/[version]
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  context: { params: { id: string; version: string } },
) {
  try {
    const prdId = context.params.id;
    const versionNum = parseInt(context.params.version, 10);

    if (isNaN(versionNum)) {
      throw new NotFoundError("Version not found");
    }

    const version = await prisma.prdVersion.findFirst({
      where: {
        prdId,
        version: versionNum,
      },
    });

    if (!version) {
      throw new NotFoundError("Version not found");
    }

    return apiSuccess({
      id: version.id,
      prdId: version.prdId,
      version: version.version,
      content: version.content,
      authorId: version.authorId,
      changeSummary: version.changeSummary,
      createdAt: version.createdAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
