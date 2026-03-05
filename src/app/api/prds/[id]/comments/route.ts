/**
 * /api/prds/[id]/comments - PRD comments API route.
 *
 * GET  - List threaded comments for a PRD
 * POST - Create a new comment (optionally threaded via parentId)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError, NotFoundError, ForbiddenError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";
import { canAccessPrd } from "@/services/prd-access-service";
import { listComments, createComment } from "@/services/comment-service";
import type { ThreadedComment } from "@/services/comment-service";
import type { CommentData } from "@/types/comments";
import { prisma } from "@/lib/prisma";

function toCommentData(c: ThreadedComment): CommentData {
  return {
    id: c.id,
    authorId: c.authorId,
    authorName: c.author.name ?? c.author.email,
    body: c.body,
    parentId: c.parentId ?? null,
    resolved: c.resolved,
    resolvedBy: c.resolvedBy ?? undefined,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    replies: (c.replies ?? []).map(toCommentData),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CreateCommentSchema = z.object({
  body: z.string().min(1, "Comment body is required"),
  parentId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/prds/[id]/comments
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Check PRD exists
    const prd = await prisma.prd.findUnique({ where: { id } });
    if (!prd) {
      throw new NotFoundError("PRD not found");
    }

    // Check access
    const hasAccess = await canAccessPrd(session.user.id, id);
    if (!hasAccess) {
      throw new ForbiddenError("You do not have access to this PRD");
    }

    const comments = await listComments(id);
    return apiSuccess(comments.map(toCommentData));
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/prds/[id]/comments
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Check PRD exists
    const prd = await prisma.prd.findUnique({ where: { id } });
    if (!prd) {
      throw new NotFoundError("PRD not found");
    }

    // Check access
    const hasAccess = await canAccessPrd(session.user.id, id);
    if (!hasAccess) {
      throw new ForbiddenError("You do not have access to this PRD");
    }

    const data = await validateBody(CreateCommentSchema, request);

    const comment = await createComment(
      id,
      session.user.id,
      data.body,
      data.parentId,
    );

    return apiSuccess(toCommentData(comment), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
