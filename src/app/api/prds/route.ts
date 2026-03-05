/**
 * /api/prds - PRD management API routes.
 *
 * GET  - List PRDs with filtering, sorting, and pagination
 * POST - Create a new PRD record in DRAFT status
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError, ForbiddenError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";
// ---------------------------------------------------------------------------
// Allowed sort fields (whitelist to prevent injection)
// ---------------------------------------------------------------------------

const ALLOWED_SORT_FIELDS = ["updatedAt", "createdAt", "title", "status"];
const ALLOWED_ORDERS = ["asc", "desc"];
const ALLOWED_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "SUBMITTED"];

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createPrdSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  title: z.string().min(1, "title is required"),
  description: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/prds
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
    );
    const skip = (page - 1) * limit;

    // Sorting
    const sortField = ALLOWED_SORT_FIELDS.includes(
      searchParams.get("sort") || "",
    )
      ? searchParams.get("sort")!
      : "updatedAt";
    const sortOrder = ALLOWED_ORDERS.includes(
      searchParams.get("order") || "",
    )
      ? searchParams.get("order")!
      : "desc";

    // Filtering
    const where: Record<string, unknown> = { isDeleted: false };

    const projectId = searchParams.get("project");
    if (projectId) where.projectId = projectId;

    const status = searchParams.get("status");
    if (status && ALLOWED_STATUSES.includes(status)) where.status = status;

    const authorId = searchParams.get("author");
    if (authorId) where.authorId = authorId;

    const tags = searchParams.get("tags");
    if (tags) {
      where.tags = { hasSome: tags.split(",").map((t) => t.trim()) };
    }

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      const updatedAt: Record<string, Date> = {};
      if (from) updatedAt.gte = new Date(from);
      if (to) updatedAt.lte = new Date(to);
      where.updatedAt = updatedAt;
    }

    // Query
    const [items, total] = await Promise.all([
      prisma.prd.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          author: { select: { id: true, name: true } },
        },
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.prd.count({ where }),
    ]);

    return apiSuccess({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/prds
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    const data = await validateBody(createPrdSchema, request);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    // Verify user is a member of the project
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: data.projectId,
          userId,
        },
      },
    });
    if (!membership) {
      throw new ForbiddenError("User is not a member of this project");
    }

    // Create the PRD in DRAFT status
    const prd = await prisma.prd.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        projectId: data.projectId,
        authorId: userId,
        status: "DRAFT",
      },
    });

    return apiSuccess({ prdId: prd.id }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
