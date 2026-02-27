/**
 * /api/prds/[id]/tags - PRD tag management API route.
 *
 * PUT - Update tags on a PRD (author, co-authors, or admins only)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import {
  handleApiError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const UpdateTagsSchema = z.object({
  tags: z
    .array(z.string().min(1, "Tag must be non-empty"))
    .max(10, "Maximum 10 tags allowed"),
});

// ---------------------------------------------------------------------------
// PUT /api/prds/[id]/tags
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const userId = session.user.id;
    const role = session.user.role;

    // Validate body
    const data = await validateBody(UpdateTagsSchema, request);

    // Check PRD exists
    const prd = await prisma.prd.findUnique({ where: { id } });
    if (!prd) {
      throw new NotFoundError("PRD not found");
    }

    // Authorization: must be author, co-author, or admin
    const isAuthor = prd.authorId === userId;
    const isAdmin = role === "ADMIN";

    if (!isAuthor && !isAdmin) {
      const coAuthor = await prisma.prdCoAuthor.findUnique({
        where: { prdId_userId: { prdId: id, userId } },
      });
      if (!coAuthor) {
        throw new ForbiddenError(
          "Only the author, co-authors, or admins can update tags",
        );
      }
    }

    // Update tags
    const updated = await prisma.prd.update({
      where: { id },
      data: { tags: data.tags },
    });

    return apiSuccess({ id: updated.id, tags: updated.tags });
  } catch (error) {
    return handleApiError(error);
  }
}
