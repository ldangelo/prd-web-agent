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
import { handleApiError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  confluenceSpace: z.string().optional(),
  jiraProject: z.string().optional(),
  gitRepo: z.string().optional(),
  beadsProject: z.string().optional(),
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
    await requireAuth();

    const data = await validateBody(CreateProjectSchema, request);

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        confluenceSpace: data.confluenceSpace,
        jiraProject: data.jiraProject,
        gitRepo: data.gitRepo,
        beadsProject: data.beadsProject,
      },
    });

    return apiSuccess(project, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
