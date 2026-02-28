/**
 * /api/projects - Project management API routes.
 *
 * GET  - List all projects the authenticated user has access to
 * POST - Create a new project (Admin only)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, ApiError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  githubRepo: z.string().min(1, "githubRepo is required"),
  defaultLabels: z.array(z.string()).optional().default([]),
  defaultReviewers: z.array(z.string()).optional().default([]),
});

// ---------------------------------------------------------------------------
// GET /api/projects
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const role = session.user.role;

    let projects;

    if (role === "ADMIN") {
      // Admins can see all projects
      projects = await prisma.project.findMany({
        include: { members: true },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Non-admins see only projects they are a member of
      projects = await prisma.project.findMany({
        where: {
          members: {
            some: { userId },
          },
        },
        include: { members: true },
        orderBy: { createdAt: "desc" },
      });
    }

    return apiSuccess(projects);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const data = await validateBody(CreateProjectSchema, request);

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        githubRepo: data.githubRepo,
        defaultLabels: data.defaultLabels,
        defaultReviewers: data.defaultReviewers,
        members: {
          create: {
            userId: session.user.id,
          },
        },
      },
    });

    return apiSuccess(project, 201);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return handleApiError(
        new ApiError("A project with this GitHub repository already exists", 409),
      );
    }
    return handleApiError(error);
  }
}
