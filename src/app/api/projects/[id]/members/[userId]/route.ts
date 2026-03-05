/**
 * /api/projects/[id]/members/[userId] - Individual member management.
 *
 * PATCH  - Update member role (system ADMIN or project ADMIN)
 * DELETE - Remove a member from a project (system ADMIN or project ADMIN)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError, ForbiddenError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";

// ---------------------------------------------------------------------------
// Helper: check if user is system ADMIN or project ADMIN
// ---------------------------------------------------------------------------

async function requireProjectAdmin(projectId: string, userId: string, systemRole: string) {
  if (systemRole === "ADMIN") return;
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    throw new ForbiddenError("Only project admins or system admins can manage members");
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const UpdateRoleSchema = z.object({
  role: z.enum(["MEMBER", "REVIEWER", "SUBMITTER", "APPROVER", "ADMIN"]),
});

// ---------------------------------------------------------------------------
// PATCH /api/projects/[id]/members/[userId]
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const session = await requireAuth();
    const { id, userId: targetUserId } = await params;
    const actingUserId = session.user.id;
    const systemRole = session.user.role;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    await requireProjectAdmin(id, actingUserId, systemRole);

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: targetUserId } },
    });
    if (!membership) {
      throw new NotFoundError("Membership not found");
    }

    const data = await validateBody(UpdateRoleSchema, request);

    const updated = await prisma.projectMember.update({
      where: { projectId_userId: { projectId: id, userId: targetUserId } },
      data: { role: data.role },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/[id]/members/[userId]
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const session = await requireAuth();
    const { id, userId: targetUserId } = await params;
    const actingUserId = session.user.id;
    const systemRole = session.user.role;

    await requireProjectAdmin(id, actingUserId, systemRole);

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: targetUserId } },
    });
    if (!membership) {
      throw new NotFoundError("Membership not found");
    }

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: id, userId: targetUserId } },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
