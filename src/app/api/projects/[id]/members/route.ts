/**
 * /api/projects/[id]/members - Project member management API routes.
 *
 * GET  - List project members (authenticated, member or ADMIN)
 * POST - Add member to project (Admin only)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError, ForbiddenError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";
import { ApiError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const AddMemberSchema = z.object({
  userId: z.string().min(1),
  isReviewer: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// GET /api/projects/[id]/members
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

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    // Non-admins must be a member
    if (role !== "ADMIN") {
      const membership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId } },
      });
      if (!membership) {
        throw new ForbiddenError("Not a member of this project");
      }
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: true },
    });

    return apiSuccess(members);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/[id]/members
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const data = await validateBody(AddMemberSchema, request);

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Check if already a member
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: data.userId } },
    });
    if (existing) {
      throw new ApiError("User is already a member of this project", 409);
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId: id,
        userId: data.userId,
        isReviewer: data.isReviewer,
      },
      include: { user: true },
    });

    return apiSuccess(member, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
