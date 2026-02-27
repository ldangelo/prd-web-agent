/**
 * /api/prds/[id]/co-authors/[userId] - Individual co-author management.
 *
 * DELETE - Remove a co-author from a PRD (primary author or admins only)
 */
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import {
  handleApiError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// DELETE /api/prds/[id]/co-authors/[userId]
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const session = await requireAuth();
    const { id, userId } = await params;
    const currentUserId = session.user.id;
    const role = session.user.role;

    // Check PRD exists
    const prd = await prisma.prd.findUnique({ where: { id } });
    if (!prd) {
      throw new NotFoundError("PRD not found");
    }

    // Authorization: only primary author or admin
    const isAuthor = prd.authorId === currentUserId;
    const isAdmin = role === "ADMIN";
    if (!isAuthor && !isAdmin) {
      throw new ForbiddenError(
        "Only the primary author or admins can manage co-authors",
      );
    }

    // Check co-author exists
    const coAuthor = await prisma.prdCoAuthor.findUnique({
      where: { prdId_userId: { prdId: id, userId } },
    });
    if (!coAuthor) {
      throw new NotFoundError("Co-author relationship not found");
    }

    // Delete
    await prisma.prdCoAuthor.delete({
      where: { prdId_userId: { prdId: id, userId } },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
