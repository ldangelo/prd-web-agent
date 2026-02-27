/**
 * Comment Service.
 *
 * Manages threaded comments on PRDs — creation, listing (with nesting),
 * resolving/unresolving, and unresolved count.
 */
import { prisma } from "@/lib/prisma";
import { createNotification } from "./notification-service";
import { ForbiddenError, NotFoundError } from "@/lib/api/errors";

/** Shape of a comment with nested replies for API responses. */
export interface ThreadedComment {
  id: string;
  prdId: string;
  authorId: string;
  parentId: string | null;
  body: string;
  resolved: boolean;
  resolvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string; email: string; avatarUrl: string | null };
  replies: ThreadedComment[];
}

/**
 * List all comments for a PRD in a threaded structure.
 *
 * Fetches all comments in one query (with author), then assembles
 * a tree of top-level comments with nested replies.
 *
 * @param prdId - The PRD to list comments for
 * @returns Array of top-level comments with nested replies
 */
export async function listComments(prdId: string): Promise<ThreadedComment[]> {
  const comments = await prisma.comment.findMany({
    where: { prdId },
    include: {
      author: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Build a map for efficient lookup
  const commentMap = new Map<string, ThreadedComment>();
  for (const c of comments) {
    commentMap.set(c.id, { ...c, replies: [] } as ThreadedComment);
  }

  // Assemble the tree
  const topLevel: ThreadedComment[] = [];
  for (const c of commentMap.values()) {
    if (c.parentId && commentMap.has(c.parentId)) {
      commentMap.get(c.parentId)!.replies.push(c);
    } else {
      topLevel.push(c);
    }
  }

  return topLevel;
}

/**
 * Create a new comment on a PRD.
 *
 * If the comment is a reply (parentId is set), the parentId is validated
 * to ensure it belongs to the same PRD.
 *
 * Sends a notification to the PRD author (unless the commenter is the author).
 *
 * @param prdId - The PRD to comment on
 * @param authorId - The user creating the comment
 * @param body - The comment text
 * @param parentId - Optional parent comment ID for threading
 * @returns The created comment with author info
 */
export async function createComment(
  prdId: string,
  authorId: string,
  body: string,
  parentId?: string,
) {
  // Validate parent exists and belongs to same PRD
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
    });
    if (!parent || parent.prdId !== prdId) {
      throw new NotFoundError("Parent comment not found");
    }
  }

  const comment = await prisma.comment.create({
    data: {
      prdId,
      authorId,
      body,
      parentId: parentId ?? null,
    },
    include: {
      author: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });

  // Send notification to PRD author (best-effort, don't block)
  try {
    const prd = await prisma.prd.findUnique({ where: { id: prdId } });
    if (prd && prd.authorId !== authorId) {
      const commenter = await prisma.user.findUnique({
        where: { id: authorId },
      });
      const commenterName = commenter?.name ?? "Someone";
      await createNotification(
        prd.authorId,
        "comment",
        `${commenterName} commented on "${prd.title}"`,
        prdId,
      );
    }
  } catch {
    // Best-effort — notification failure should not break comment creation
  }

  return comment;
}

/**
 * Toggle the resolved status of a comment.
 *
 * Authorization: only the PRD author, comment author, or an admin
 * can resolve/unresolve a comment.
 *
 * @param commentId - The comment to resolve/unresolve
 * @param userId - The user performing the action
 * @returns The updated comment
 * @throws NotFoundError if the comment does not exist
 * @throws ForbiddenError if the user lacks permission
 */
export async function resolveComment(commentId: string, userId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { prd: true },
  });

  if (!comment) {
    throw new NotFoundError("Comment not found");
  }

  // Check authorization
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isCommentAuthor = comment.authorId === userId;
  const isPrdAuthor = comment.prd.authorId === userId;
  const isAdmin = user?.role === "ADMIN";

  if (!isCommentAuthor && !isPrdAuthor && !isAdmin) {
    throw new ForbiddenError(
      "Only the PRD author, comment author, or an admin can resolve comments",
    );
  }

  const newResolved = !comment.resolved;

  return prisma.comment.update({
    where: { id: commentId },
    data: {
      resolved: newResolved,
      resolvedBy: newResolved ? userId : null,
    },
    include: {
      author: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });
}

/**
 * Get the count of unresolved comments on a PRD.
 *
 * @param prdId - The PRD to check
 * @returns Number of unresolved comments
 */
export async function getUnresolvedCount(prdId: string): Promise<number> {
  return prisma.comment.count({
    where: { prdId, resolved: false },
  });
}
