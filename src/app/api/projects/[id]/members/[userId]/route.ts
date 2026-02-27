/**
 * /api/projects/[id]/members/[userId] - Individual member management.
 *
 * DELETE - Remove a member from a project (Admin only)
 */
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// DELETE /api/projects/[id]/members/[userId]
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    await requireAdmin();
    const { id, userId } = await params;

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });

    if (!membership) {
      throw new NotFoundError("Membership not found");
    }

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: id, userId } },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
