/**
 * Status Workflow Service tests.
 *
 * Tests for transition validation, state machine logic,
 * reviewer auto-assignment, and unresolved comment blocking.
 * Uses mocked Prisma client and AuditService.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockPrdFindUnique = jest.fn();
const mockPrdUpdate = jest.fn();
const mockUserFindUnique = jest.fn();
const mockPrdCoAuthorFindFirst = jest.fn();
const mockProjectMemberFindMany = jest.fn();
const mockNotificationCreateMany = jest.fn();
const mockCommentCount = jest.fn();
const mockGlobalSettingsFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findUnique: (...args: unknown[]) => mockPrdFindUnique(...args),
      update: (...args: unknown[]) => mockPrdUpdate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    prdCoAuthor: {
      findFirst: (...args: unknown[]) => mockPrdCoAuthorFindFirst(...args),
    },
    projectMember: {
      findMany: (...args: unknown[]) => mockProjectMemberFindMany(...args),
    },
    notification: {
      createMany: (...args: unknown[]) => mockNotificationCreateMany(...args),
    },
    comment: {
      count: (...args: unknown[]) => mockCommentCount(...args),
    },
    globalSettings: {
      findUnique: (...args: unknown[]) => mockGlobalSettingsFindUnique(...args),
    },
  },
}));

const mockLogTransition = jest.fn();
jest.mock("../audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    logTransition: (...args: unknown[]) => mockLogTransition(...args),
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { StatusWorkflowService } from "../status-workflow-service";
import { PrdStatus } from "../status-workflow-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_PRD_DRAFT = {
  id: "prd_001",
  title: "Test PRD",
  authorId: "user_author",
  projectId: "proj_001",
  status: "DRAFT" as PrdStatus,
};

const MOCK_PRD_IN_REVIEW = {
  ...MOCK_PRD_DRAFT,
  status: "IN_REVIEW" as PrdStatus,
};

const MOCK_PRD_APPROVED = {
  ...MOCK_PRD_DRAFT,
  status: "APPROVED" as PrdStatus,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StatusWorkflowService", () => {
  let service: StatusWorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StatusWorkflowService();

    // Default: user exists as author
    mockUserFindUnique.mockResolvedValue({
      id: "user_author",
      name: "Author",
      email: "author@example.com",
      role: "AUTHOR",
    });

    // Default: no co-author relationship
    mockPrdCoAuthorFindFirst.mockResolvedValue(null);

    // Default: update succeeds
    mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_DRAFT, status: "IN_REVIEW" });

    // Default: audit succeeds
    mockLogTransition.mockResolvedValue(undefined);

    // Default: no reviewers
    mockProjectMemberFindMany.mockResolvedValue([]);

    // Default: no notifications
    mockNotificationCreateMany.mockResolvedValue({ count: 0 });

    // Default: no unresolved comments
    mockCommentCount.mockResolvedValue(0);

    // Default: global settings with blocking enabled
    mockGlobalSettingsFindUnique.mockResolvedValue({
      id: "global",
      blockApprovalOnUnresolvedComments: true,
    });
  });

  // -----------------------------------------------------------------------
  // getValidTransitions
  // -----------------------------------------------------------------------

  describe("getValidTransitions", () => {
    it("should return [IN_REVIEW] for DRAFT", () => {
      expect(service.getValidTransitions("DRAFT")).toEqual(["IN_REVIEW"]);
    });

    it("should return [APPROVED, DRAFT] for IN_REVIEW", () => {
      const transitions = service.getValidTransitions("IN_REVIEW");
      expect(transitions).toContain("APPROVED");
      expect(transitions).toContain("DRAFT");
      expect(transitions).toHaveLength(2);
    });

    it("should return [SUBMITTED, DRAFT] for APPROVED", () => {
      const transitions = service.getValidTransitions("APPROVED");
      expect(transitions).toContain("SUBMITTED");
      expect(transitions).toContain("DRAFT");
      expect(transitions).toHaveLength(2);
    });

    it("should return [] for SUBMITTED", () => {
      expect(service.getValidTransitions("SUBMITTED")).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // isValidTransition
  // -----------------------------------------------------------------------

  describe("isValidTransition", () => {
    it("should allow DRAFT -> IN_REVIEW", () => {
      expect(service.isValidTransition("DRAFT", "IN_REVIEW")).toBe(true);
    });

    it("should allow IN_REVIEW -> APPROVED", () => {
      expect(service.isValidTransition("IN_REVIEW", "APPROVED")).toBe(true);
    });

    it("should allow IN_REVIEW -> DRAFT (rejection)", () => {
      expect(service.isValidTransition("IN_REVIEW", "DRAFT")).toBe(true);
    });

    it("should allow APPROVED -> SUBMITTED", () => {
      expect(service.isValidTransition("APPROVED", "SUBMITTED")).toBe(true);
    });

    it("should allow APPROVED -> DRAFT (re-open)", () => {
      expect(service.isValidTransition("APPROVED", "DRAFT")).toBe(true);
    });

    it("should reject DRAFT -> APPROVED (skip)", () => {
      expect(service.isValidTransition("DRAFT", "APPROVED")).toBe(false);
    });

    it("should reject DRAFT -> SUBMITTED (skip)", () => {
      expect(service.isValidTransition("DRAFT", "SUBMITTED")).toBe(false);
    });

    it("should reject SUBMITTED -> any", () => {
      expect(service.isValidTransition("SUBMITTED", "DRAFT")).toBe(false);
      expect(service.isValidTransition("SUBMITTED", "IN_REVIEW")).toBe(false);
      expect(service.isValidTransition("SUBMITTED", "APPROVED")).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // transition
  // -----------------------------------------------------------------------

  describe("transition", () => {
    it("should transition DRAFT -> IN_REVIEW for the author", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_DRAFT);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_DRAFT, status: "IN_REVIEW" });

      await service.transition("prd_001", "user_author", "IN_REVIEW");

      expect(mockPrdUpdate).toHaveBeenCalledWith({
        where: { id: "prd_001" },
        data: { status: "IN_REVIEW" },
      });
      expect(mockLogTransition).toHaveBeenCalledWith(
        "prd_001",
        "user_author",
        "STATUS_CHANGE",
        "DRAFT",
        "IN_REVIEW",
        undefined,
      );
    });

    it("should transition DRAFT -> IN_REVIEW for a co-author", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_DRAFT);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_DRAFT, status: "IN_REVIEW" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_coauthor",
        name: "Co-Author",
        email: "coauthor@example.com",
        role: "AUTHOR",
      });
      mockPrdCoAuthorFindFirst.mockResolvedValue({
        id: "ca_1",
        prdId: "prd_001",
        userId: "user_coauthor",
      });

      await service.transition("prd_001", "user_coauthor", "IN_REVIEW");

      expect(mockPrdUpdate).toHaveBeenCalled();
    });

    it("should reject invalid transition", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_DRAFT);

      await expect(
        service.transition("prd_001", "user_author", "APPROVED"),
      ).rejects.toThrow("Invalid status transition from DRAFT to APPROVED");
    });

    it("should throw when PRD not found", async () => {
      mockPrdFindUnique.mockResolvedValue(null);

      await expect(
        service.transition("prd_999", "user_author", "IN_REVIEW"),
      ).rejects.toThrow("PRD not found");
    });

    it("should require comment when rejecting (IN_REVIEW -> DRAFT)", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockUserFindUnique.mockResolvedValue({
        id: "user_reviewer",
        name: "Reviewer",
        email: "reviewer@example.com",
        role: "REVIEWER",
      });

      await expect(
        service.transition("prd_001", "user_reviewer", "DRAFT"),
      ).rejects.toThrow("Comment is required when rejecting");
    });

    it("should allow rejection with comment", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_IN_REVIEW, status: "DRAFT" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_reviewer",
        name: "Reviewer",
        email: "reviewer@example.com",
        role: "REVIEWER",
      });

      await service.transition(
        "prd_001",
        "user_reviewer",
        "DRAFT",
        "Needs revision on section 3",
      );

      expect(mockPrdUpdate).toHaveBeenCalledWith({
        where: { id: "prd_001" },
        data: { status: "DRAFT" },
      });
      expect(mockLogTransition).toHaveBeenCalledWith(
        "prd_001",
        "user_reviewer",
        "STATUS_CHANGE",
        "IN_REVIEW",
        "DRAFT",
        { comment: "Needs revision on section 3" },
      );
    });

    // -------------------------------------------------------------------
    // Authorization checks
    // -------------------------------------------------------------------

    it("should reject non-author/non-co-author submitting for review", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_DRAFT);
      mockUserFindUnique.mockResolvedValue({
        id: "user_random",
        name: "Random",
        email: "random@example.com",
        role: "AUTHOR",
      });
      mockPrdCoAuthorFindFirst.mockResolvedValue(null);

      await expect(
        service.transition("prd_001", "user_random", "IN_REVIEW"),
      ).rejects.toThrow("Only the author or co-authors can submit for review");
    });

    it("should allow admin to perform any valid transition", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_DRAFT);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_DRAFT, status: "IN_REVIEW" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_admin",
        name: "Admin",
        email: "admin@example.com",
        role: "ADMIN",
      });

      await service.transition("prd_001", "user_admin", "IN_REVIEW");

      expect(mockPrdUpdate).toHaveBeenCalled();
    });

    it("should reject non-reviewer/non-admin approving", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockUserFindUnique.mockResolvedValue({
        id: "user_author",
        name: "Author",
        email: "author@example.com",
        role: "AUTHOR",
      });

      await expect(
        service.transition("prd_001", "user_author", "APPROVED"),
      ).rejects.toThrow("Only reviewers or admins can approve");
    });

    it("should allow reviewer to approve", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_IN_REVIEW, status: "APPROVED" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_reviewer",
        name: "Reviewer",
        email: "reviewer@example.com",
        role: "REVIEWER",
      });
      mockCommentCount.mockResolvedValue(0);

      await service.transition("prd_001", "user_reviewer", "APPROVED");

      expect(mockPrdUpdate).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------
    // TASK-028: Reviewer auto-assignment
    // -------------------------------------------------------------------

    it("should notify reviewers when transitioning to IN_REVIEW", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_DRAFT);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_DRAFT, status: "IN_REVIEW" });
      mockProjectMemberFindMany.mockResolvedValue([
        { userId: "user_rev1", isReviewer: true },
        { userId: "user_rev2", isReviewer: true },
      ]);
      mockNotificationCreateMany.mockResolvedValue({ count: 2 });

      await service.transition("prd_001", "user_author", "IN_REVIEW");

      expect(mockProjectMemberFindMany).toHaveBeenCalledWith({
        where: {
          projectId: "proj_001",
          isReviewer: true,
        },
      });
      expect(mockNotificationCreateMany).toHaveBeenCalledWith({
        data: [
          {
            userId: "user_rev1",
            prdId: "prd_001",
            type: "REVIEW_REQUESTED",
            message: expect.stringContaining("Test PRD"),
          },
          {
            userId: "user_rev2",
            prdId: "prd_001",
            type: "REVIEW_REQUESTED",
            message: expect.stringContaining("Test PRD"),
          },
        ],
      });
    });

    it("should not create notifications when no reviewers exist", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_DRAFT);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_DRAFT, status: "IN_REVIEW" });
      mockProjectMemberFindMany.mockResolvedValue([]);

      await service.transition("prd_001", "user_author", "IN_REVIEW");

      expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------
    // TASK-031: Unresolved comments block approval
    // -------------------------------------------------------------------

    it("should block approval when unresolved comments exist and setting is enabled", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockUserFindUnique.mockResolvedValue({
        id: "user_reviewer",
        name: "Reviewer",
        email: "reviewer@example.com",
        role: "REVIEWER",
      });
      mockGlobalSettingsFindUnique.mockResolvedValue({
        id: "global",
        blockApprovalOnUnresolvedComments: true,
      });
      mockCommentCount.mockResolvedValue(3);

      await expect(
        service.transition("prd_001", "user_reviewer", "APPROVED"),
      ).rejects.toThrow("Cannot approve: 3 unresolved comment(s) remain");
    });

    it("should allow approval when unresolved comments exist but setting is disabled", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_IN_REVIEW, status: "APPROVED" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_reviewer",
        name: "Reviewer",
        email: "reviewer@example.com",
        role: "REVIEWER",
      });
      mockGlobalSettingsFindUnique.mockResolvedValue({
        id: "global",
        blockApprovalOnUnresolvedComments: false,
      });
      mockCommentCount.mockResolvedValue(3);

      await service.transition("prd_001", "user_reviewer", "APPROVED");

      expect(mockPrdUpdate).toHaveBeenCalled();
    });

    it("should allow approval when no unresolved comments exist", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_IN_REVIEW, status: "APPROVED" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_reviewer",
        name: "Reviewer",
        email: "reviewer@example.com",
        role: "REVIEWER",
      });
      mockCommentCount.mockResolvedValue(0);

      await service.transition("prd_001", "user_reviewer", "APPROVED");

      expect(mockPrdUpdate).toHaveBeenCalled();
    });

    it("should allow approval when global settings record does not exist", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_IN_REVIEW, status: "APPROVED" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_reviewer",
        name: "Reviewer",
        email: "reviewer@example.com",
        role: "REVIEWER",
      });
      mockGlobalSettingsFindUnique.mockResolvedValue(null);
      mockCommentCount.mockResolvedValue(5);

      await service.transition("prd_001", "user_reviewer", "APPROVED");

      expect(mockPrdUpdate).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------
    // APPROVED -> SUBMITTED
    // -------------------------------------------------------------------

    it("should transition APPROVED -> SUBMITTED for the author", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_APPROVED);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_APPROVED, status: "SUBMITTED" });

      await service.transition("prd_001", "user_author", "SUBMITTED");

      expect(mockPrdUpdate).toHaveBeenCalledWith({
        where: { id: "prd_001" },
        data: { status: "SUBMITTED" },
      });
    });

    // -------------------------------------------------------------------
    // APPROVED -> DRAFT (re-open)
    // -------------------------------------------------------------------

    it("should allow re-opening an approved PRD (APPROVED -> DRAFT)", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_APPROVED);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_APPROVED, status: "DRAFT" });

      await service.transition("prd_001", "user_author", "DRAFT");

      expect(mockPrdUpdate).toHaveBeenCalledWith({
        where: { id: "prd_001" },
        data: { status: "DRAFT" },
      });
    });
  });
});
