/**
 * /api/prds/[id]/co-authors - PRD co-author management API route.
 *
 * POST - Add a co-author to a PRD (primary author or admins only)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import {
  ApiError,
  handleApiError,
  NotFoundError,
  ForbiddenError,
} from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const AddCoAuthorSchema = z.object({
  userId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST /api/prds/[id]/co-authors
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
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

    // Validate body
    const data = await validateBody(AddCoAuthorSchema, request);

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Check for duplicates
    const existing = await prisma.prdCoAuthor.findUnique({
      where: { prdId_userId: { prdId: id, userId: data.userId } },
    });
    if (existing) {
      throw new ApiError("User is already a co-author of this PRD", 409);
    }

    // Create co-author relationship
    const coAuthor = await prisma.prdCoAuthor.create({
      data: {
        prdId: id,
        userId: data.userId,
      },
      include: { user: true },
    });

    return apiSuccess(coAuthor, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
