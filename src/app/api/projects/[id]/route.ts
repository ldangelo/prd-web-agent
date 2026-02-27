/**
 * /api/projects/[id] - Single project management API routes.
 *
 * GET    - Get project details (member or ADMIN)
 * PUT    - Update project (Admin only)
 * DELETE - Delete project (Admin only)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError, ForbiddenError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  githubRepo: z.string().min(1).optional(),
  defaultLabels: z.array(z.string()).optional(),
  defaultReviewers: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/projects/[id]
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const userId = session.user.id;
    const role = session.user.role;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { members: { include: { user: true } } },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    // Non-admins must be a member
    if (role !== "ADMIN") {
      const isMember = project.members.some((m: { userId: string }) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenError("Not a member of this project");
      }
    }

    return apiSuccess(project);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/projects/[id]
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Project not found");
    }

    const data = await validateBody(UpdateProjectSchema, request);

    const updated = await prisma.project.update({
      where: { id },
      data,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/projects/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Project not found");
    }

    await prisma.project.delete({ where: { id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
