/**
 * /api/projects/[id]/members - Project member management API routes.
 *
 * GET  - List project members (authenticated, member or system ADMIN)
 * POST - Add member to project (system ADMIN or project ADMIN)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError, ForbiddenError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";
import { ApiError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const AddMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["MEMBER", "REVIEWER", "SUBMITTER", "APPROVER", "ADMIN"]).optional().default("MEMBER"),
});

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
    const systemRole = session.user.role;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    // Non-system-admins must be a member
    if (systemRole !== "ADMIN") {
      const membership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId } },
      });
      if (!membership) {
        throw new ForbiddenError("Not a member of this project");
      }
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } },
      orderBy: { user: { name: "asc" } },
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
    const session = await requireAuth();
    const { id } = await params;
    const userId = session.user.id;
    const systemRole = session.user.role;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    await requireProjectAdmin(id, userId, systemRole);

    const data = await validateBody(AddMemberSchema, request);

    // Find user by email
    const targetUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (!targetUser) {
      throw new NotFoundError("No user found with that email address");
    }

    // Check if already a member
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: targetUser.id } },
    });
    if (existing) {
      throw new ApiError("User is already a member of this project", 409);
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId: id,
        userId: targetUser.id,
        role: data.role,
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } },
    });

    return apiSuccess(member, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
