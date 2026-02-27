/**
 * Comment Service tests.
 *
 * Tests for listComments, createComment, resolveComment, and getUnresolvedCount.
 * Prisma and notification-service are mocked.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockCommentFindMany = jest.fn();
const mockCommentFindUnique = jest.fn();
const mockCommentCreate = jest.fn();
const mockCommentUpdate = jest.fn();
const mockCommentCount = jest.fn();
const mockPrdFindUnique = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    comment: {
      findMany: (...args: unknown[]) => mockCommentFindMany(...args),
      findUnique: (...args: unknown[]) => mockCommentFindUnique(...args),
      create: (...args: unknown[]) => mockCommentCreate(...args),
      update: (...args: unknown[]) => mockCommentUpdate(...args),
      count: (...args: unknown[]) => mockCommentCount(...args),
    },
    prd: {
      findUnique: (...args: unknown[]) => mockPrdFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

const mockCreateNotification = jest.fn();
jest.mock("../notification-service", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  listComments,
  createComment,
  resolveComment,
  getUnresolvedCount,
} from "../comment-service";
import { NotFoundError, ForbiddenError } from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_AUTHOR = {
  id: "user_author",
  name: "Author",
  email: "author@test.com",
  avatarUrl: null,
};

const MOCK_COMMENTER = {
  id: "user_commenter",
  name: "Commenter",
  email: "commenter@test.com",
  avatarUrl: null,
};

const MOCK_PRD = {
  id: "prd_001",
  title: "Test PRD",
  authorId: "user_author",
  projectId: "proj_001",
};

const MOCK_COMMENT_1 = {
  id: "comment_001",
  prdId: "prd_001",
  authorId: "user_commenter",
  parentId: null,
  body: "Top level comment",
  resolved: false,
  resolvedBy: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  author: MOCK_COMMENTER,
};

const MOCK_REPLY = {
  id: "comment_002",
  prdId: "prd_001",
  authorId: "user_author",
  parentId: "comment_001",
  body: "Reply to top level",
  resolved: false,
  resolvedBy: null,
  createdAt: new Date("2026-01-02"),
  updatedAt: new Date("2026-01-02"),
  author: MOCK_AUTHOR,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CommentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("listComments", () => {
    it("should return threaded comments with replies nested", async () => {
      mockCommentFindMany.mockResolvedValue([MOCK_COMMENT_1, MOCK_REPLY]);

      const result = await listComments("prd_001");

      // Should have one top-level comment
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("comment_001");
      // With one reply
      expect(result[0].replies).toHaveLength(1);
      expect(result[0].replies[0].id).toBe("comment_002");
    });

    it("should return empty array when no comments", async () => {
      mockCommentFindMany.mockResolvedValue([]);

      const result = await listComments("prd_001");

      expect(result).toEqual([]);
    });

    it("should handle multiple top-level comments", async () => {
      const secondTopLevel = {
        ...MOCK_COMMENT_1,
        id: "comment_003",
        body: "Another top level",
      };
      mockCommentFindMany.mockResolvedValue([MOCK_COMMENT_1, secondTopLevel]);

      const result = await listComments("prd_001");

      expect(result).toHaveLength(2);
    });
  });

  describe("createComment", () => {
    it("should create a top-level comment", async () => {
      mockCommentCreate.mockResolvedValue(MOCK_COMMENT_1);
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD);
      mockUserFindUnique.mockResolvedValue(MOCK_COMMENTER);

      const result = await createComment(
        "prd_001",
        "user_commenter",
        "Top level comment",
      );

      expect(result).toEqual(MOCK_COMMENT_1);
      expect(mockCommentCreate).toHaveBeenCalledWith({
        data: {
          prdId: "prd_001",
          authorId: "user_commenter",
          body: "Top level comment",
          parentId: null,
        },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });
    });

    it("should create a reply with parentId", async () => {
      mockCommentFindUnique.mockResolvedValue(MOCK_COMMENT_1);
      mockCommentCreate.mockResolvedValue(MOCK_REPLY);
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD);
      mockUserFindUnique.mockResolvedValue(MOCK_AUTHOR);

      const result = await createComment(
        "prd_001",
        "user_author",
        "Reply to top level",
        "comment_001",
      );

      expect(result).toEqual(MOCK_REPLY);
      expect(mockCommentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ parentId: "comment_001" }),
        }),
      );
    });

    it("should throw NotFoundError when parentId does not exist", async () => {
      mockCommentFindUnique.mockResolvedValue(null);

      await expect(
        createComment("prd_001", "user_commenter", "Reply", "nonexistent"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw NotFoundError when parent belongs to different PRD", async () => {
      mockCommentFindUnique.mockResolvedValue({
        ...MOCK_COMMENT_1,
        prdId: "prd_other",
      });

      await expect(
        createComment("prd_001", "user_commenter", "Reply", "comment_001"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should send notification to PRD author", async () => {
      mockCommentCreate.mockResolvedValue(MOCK_COMMENT_1);
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD);
      mockUserFindUnique.mockResolvedValue(MOCK_COMMENTER);

      await createComment("prd_001", "user_commenter", "A comment");

      expect(mockCreateNotification).toHaveBeenCalledWith(
        "user_author",
        "comment",
        expect.stringContaining("Commenter"),
        "prd_001",
      );
    });

    it("should not send notification when commenter is the PRD author", async () => {
      mockCommentCreate.mockResolvedValue({
        ...MOCK_COMMENT_1,
        authorId: "user_author",
      });
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD);

      await createComment("prd_001", "user_author", "My own comment");

      expect(mockCreateNotification).not.toHaveBeenCalled();
    });
  });

  describe("resolveComment", () => {
    it("should resolve an unresolved comment", async () => {
      mockCommentFindUnique.mockResolvedValue({
        ...MOCK_COMMENT_1,
        prd: MOCK_PRD,
        resolved: false,
      });
      mockUserFindUnique.mockResolvedValue({
        id: "user_author",
        role: "AUTHOR",
      });
      mockCommentUpdate.mockResolvedValue({
        ...MOCK_COMMENT_1,
        resolved: true,
        resolvedBy: "user_author",
      });

      const result = await resolveComment("comment_001", "user_author");

      expect(result.resolved).toBe(true);
      expect(result.resolvedBy).toBe("user_author");
      expect(mockCommentUpdate).toHaveBeenCalledWith({
        where: { id: "comment_001" },
        data: { resolved: true, resolvedBy: "user_author" },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });
    });

    it("should unresolve a resolved comment", async () => {
      mockCommentFindUnique.mockResolvedValue({
        ...MOCK_COMMENT_1,
        prd: MOCK_PRD,
        resolved: true,
        resolvedBy: "user_author",
      });
      mockUserFindUnique.mockResolvedValue({
        id: "user_author",
        role: "AUTHOR",
      });
      mockCommentUpdate.mockResolvedValue({
        ...MOCK_COMMENT_1,
        resolved: false,
        resolvedBy: null,
      });

      const result = await resolveComment("comment_001", "user_author");

      expect(result.resolved).toBe(false);
      expect(result.resolvedBy).toBeNull();
      expect(mockCommentUpdate).toHaveBeenCalledWith({
        where: { id: "comment_001" },
        data: { resolved: false, resolvedBy: null },
        include: {
          author: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });
    });

    it("should throw NotFoundError if comment does not exist", async () => {
      mockCommentFindUnique.mockResolvedValue(null);

      await expect(
        resolveComment("nonexistent", "user_author"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError for unauthorized user", async () => {
      mockCommentFindUnique.mockResolvedValue({
        ...MOCK_COMMENT_1,
        prd: MOCK_PRD,
      });
      mockUserFindUnique.mockResolvedValue({
        id: "user_random",
        role: "AUTHOR",
      });

      await expect(
        resolveComment("comment_001", "user_random"),
      ).rejects.toThrow(ForbiddenError);
    });

    it("should allow admin to resolve", async () => {
      mockCommentFindUnique.mockResolvedValue({
        ...MOCK_COMMENT_1,
        prd: MOCK_PRD,
        resolved: false,
      });
      mockUserFindUnique.mockResolvedValue({
        id: "user_admin",
        role: "ADMIN",
      });
      mockCommentUpdate.mockResolvedValue({
        ...MOCK_COMMENT_1,
        resolved: true,
        resolvedBy: "user_admin",
      });

      const result = await resolveComment("comment_001", "user_admin");

      expect(result.resolved).toBe(true);
    });

    it("should allow comment author to resolve", async () => {
      mockCommentFindUnique.mockResolvedValue({
        ...MOCK_COMMENT_1,
        prd: MOCK_PRD,
        resolved: false,
      });
      mockUserFindUnique.mockResolvedValue({
        id: "user_commenter",
        role: "AUTHOR",
      });
      mockCommentUpdate.mockResolvedValue({
        ...MOCK_COMMENT_1,
        resolved: true,
        resolvedBy: "user_commenter",
      });

      const result = await resolveComment("comment_001", "user_commenter");

      expect(result.resolved).toBe(true);
    });
  });

  describe("getUnresolvedCount", () => {
    it("should return the count of unresolved comments", async () => {
      mockCommentCount.mockResolvedValue(3);

      const result = await getUnresolvedCount("prd_001");

      expect(result).toBe(3);
      expect(mockCommentCount).toHaveBeenCalledWith({
        where: { prdId: "prd_001", resolved: false },
      });
    });
  });
});
