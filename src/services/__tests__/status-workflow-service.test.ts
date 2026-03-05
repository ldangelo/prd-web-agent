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
const mockProjectMemberFindUnique = jest.fn();
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
      findUnique: (...args: unknown[]) => mockProjectMemberFindUnique(...args),
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

// Helper: membership with a given role
function membership(role: string) {
  return { id: "pm_1", projectId: "proj_001", userId: "user_1", role };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StatusWorkflowService", () => {
  let service: StatusWorkflowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StatusWorkflowService();

    // Default: user exists as author (non-admin system role)
    mockUserFindUnique.mockResolvedValue({
      id: "user_author",
      name: "Author",
      email: "author@example.com",
      role: "AUTHOR",
    });

    // Default: author has SUBMITTER project role
    mockProjectMemberFindUnique.mockResolvedValue(membership("SUBMITTER"));

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

    it("should return [DRAFT] for SUBMITTED", () => {
      expect(service.getValidTransitions("SUBMITTED")).toEqual(["DRAFT"]);
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

    it("should allow SUBMITTED -> DRAFT (re-open for refinement)", () => {
      expect(service.isValidTransition("SUBMITTED", "DRAFT")).toBe(true);
    });

    it("should reject SUBMITTED -> IN_REVIEW or APPROVED", () => {
      expect(service.isValidTransition("SUBMITTED", "IN_REVIEW")).toBe(false);
      expect(service.isValidTransition("SUBMITTED", "APPROVED")).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // transition
  // -----------------------------------------------------------------------

  describe("transition", () => {
    it("should transition DRAFT -> IN_REVIEW for the author (who is the PRD author)", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_DRAFT);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_DRAFT, status: "IN_REVIEW" });
      // author is the PRD author — no project membership needed
      mockProjectMemberFindUnique.mockResolvedValue(null);

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

    it("should transition DRAFT -> IN_REVIEW for a project SUBMITTER", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_DRAFT);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_DRAFT, status: "IN_REVIEW" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_submitter",
        name: "Submitter",
        email: "submitter@example.com",
        role: "AUTHOR",
      });
      mockProjectMemberFindUnique.mockResolvedValue(membership("SUBMITTER"));

      await service.transition("prd_001", "user_submitter", "IN_REVIEW");

      expect(mockPrdUpdate).toHaveBeenCalled();
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
      // Not submitter/admin project role
      mockProjectMemberFindUnique.mockResolvedValue(membership("MEMBER"));
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
        id: "user_approver",
        name: "Approver",
        email: "approver@example.com",
        role: "AUTHOR",
      });
      mockProjectMemberFindUnique.mockResolvedValue(membership("APPROVER"));

      await expect(
        service.transition("prd_001", "user_approver", "DRAFT"),
      ).rejects.toThrow("Comment is required when rejecting");
    });

    it("should allow rejection with comment by project APPROVER", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_IN_REVIEW, status: "DRAFT" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_approver",
        name: "Approver",
        email: "approver@example.com",
        role: "AUTHOR",
      });
      mockProjectMemberFindUnique.mockResolvedValue(membership("APPROVER"));

      await service.transition(
        "prd_001",
        "user_approver",
        "DRAFT",
        "Needs revision on section 3",
      );

      expect(mockPrdUpdate).toHaveBeenCalledWith({
        where: { id: "prd_001" },
        data: { status: "DRAFT" },
      });
      expect(mockLogTransition).toHaveBeenCalledWith(
        "prd_001",
        "user_approver",
        "STATUS_CHANGE",
        "IN_REVIEW",
        "DRAFT",
        { comment: "Needs revision on section 3" },
      );
    });

    // -------------------------------------------------------------------
    // Authorization checks
    // -------------------------------------------------------------------

    it("should reject member with MEMBER role submitting for review", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_DRAFT);
      mockUserFindUnique.mockResolvedValue({
        id: "user_random",
        name: "Random",
        email: "random@example.com",
        role: "AUTHOR",
      });
      mockProjectMemberFindUnique.mockResolvedValue(membership("MEMBER"));
      mockPrdCoAuthorFindFirst.mockResolvedValue(null);

      await expect(
        service.transition("prd_001", "user_random", "IN_REVIEW"),
      ).rejects.toThrow("Only the author, co-authors, or project submitters can submit for review");
    });

    it("should allow system ADMIN to perform any valid transition", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_DRAFT);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_DRAFT, status: "IN_REVIEW" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_admin",
        name: "Admin",
        email: "admin@example.com",
        role: "ADMIN",
      });
      // System admin: projectMember.findUnique is not called
      mockProjectMemberFindUnique.mockResolvedValue(null);

      await service.transition("prd_001", "user_admin", "IN_REVIEW");

      expect(mockPrdUpdate).toHaveBeenCalled();
    });

    it("should reject non-approver approving (only MEMBER project role)", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockUserFindUnique.mockResolvedValue({
        id: "user_author",
        name: "Author",
        email: "author@example.com",
        role: "AUTHOR",
      });
      mockProjectMemberFindUnique.mockResolvedValue(membership("MEMBER"));

      await expect(
        service.transition("prd_001", "user_author", "APPROVED"),
      ).rejects.toThrow("Only project approvers or admins can approve");
    });

    it("should allow project APPROVER to approve", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_IN_REVIEW, status: "APPROVED" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_approver",
        name: "Approver",
        email: "approver@example.com",
        role: "AUTHOR",
      });
      mockProjectMemberFindUnique.mockResolvedValue(membership("APPROVER"));
      mockCommentCount.mockResolvedValue(0);

      await service.transition("prd_001", "user_approver", "APPROVED");

      expect(mockPrdUpdate).toHaveBeenCalled();
    });

    it("should allow project ADMIN to approve", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_IN_REVIEW, status: "APPROVED" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_proj_admin",
        name: "Project Admin",
        email: "padmin@example.com",
        role: "AUTHOR",
      });
      mockProjectMemberFindUnique.mockResolvedValue(membership("ADMIN"));
      mockCommentCount.mockResolvedValue(0);

      await service.transition("prd_001", "user_proj_admin", "APPROVED");

      expect(mockPrdUpdate).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------
    // TASK-028: Reviewer auto-assignment
    // -------------------------------------------------------------------

    it("should notify REVIEWER/APPROVER/ADMIN members when transitioning to IN_REVIEW", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_DRAFT);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_DRAFT, status: "IN_REVIEW" });
      mockProjectMemberFindUnique.mockResolvedValue(null); // author is PRD author
      mockProjectMemberFindMany.mockResolvedValue([
        { userId: "user_rev1", role: "REVIEWER" },
        { userId: "user_rev2", role: "APPROVER" },
      ]);
      mockNotificationCreateMany.mockResolvedValue({ count: 2 });

      await service.transition("prd_001", "user_author", "IN_REVIEW");

      expect(mockProjectMemberFindMany).toHaveBeenCalledWith({
        where: {
          projectId: "proj_001",
          role: { in: ["REVIEWER", "APPROVER", "ADMIN"] },
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
      mockProjectMemberFindUnique.mockResolvedValue(null); // PRD author
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
        id: "user_approver",
        name: "Approver",
        email: "approver@example.com",
        role: "AUTHOR",
      });
      mockProjectMemberFindUnique.mockResolvedValue(membership("APPROVER"));
      mockGlobalSettingsFindUnique.mockResolvedValue({
        id: "global",
        blockApprovalOnUnresolvedComments: true,
      });
      mockCommentCount.mockResolvedValue(3);

      await expect(
        service.transition("prd_001", "user_approver", "APPROVED"),
      ).rejects.toThrow("Cannot approve: 3 unresolved comment(s) remain");
    });

    it("should allow approval when unresolved comments exist but setting is disabled", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_IN_REVIEW, status: "APPROVED" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_approver",
        name: "Approver",
        email: "approver@example.com",
        role: "AUTHOR",
      });
      mockProjectMemberFindUnique.mockResolvedValue(membership("APPROVER"));
      mockGlobalSettingsFindUnique.mockResolvedValue({
        id: "global",
        blockApprovalOnUnresolvedComments: false,
      });
      mockCommentCount.mockResolvedValue(3);

      await service.transition("prd_001", "user_approver", "APPROVED");

      expect(mockPrdUpdate).toHaveBeenCalled();
    });

    it("should allow approval when no unresolved comments exist", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_IN_REVIEW, status: "APPROVED" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_approver",
        name: "Approver",
        email: "approver@example.com",
        role: "AUTHOR",
      });
      mockProjectMemberFindUnique.mockResolvedValue(membership("APPROVER"));
      mockCommentCount.mockResolvedValue(0);

      await service.transition("prd_001", "user_approver", "APPROVED");

      expect(mockPrdUpdate).toHaveBeenCalled();
    });

    it("should allow approval when global settings record does not exist", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_IN_REVIEW);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_IN_REVIEW, status: "APPROVED" });
      mockUserFindUnique.mockResolvedValue({
        id: "user_approver",
        name: "Approver",
        email: "approver@example.com",
        role: "AUTHOR",
      });
      mockProjectMemberFindUnique.mockResolvedValue(membership("APPROVER"));
      mockGlobalSettingsFindUnique.mockResolvedValue(null);
      mockCommentCount.mockResolvedValue(5);

      await service.transition("prd_001", "user_approver", "APPROVED");

      expect(mockPrdUpdate).toHaveBeenCalled();
    });

    // -------------------------------------------------------------------
    // APPROVED -> SUBMITTED
    // -------------------------------------------------------------------

    it("should transition APPROVED -> SUBMITTED for the author", async () => {
      mockPrdFindUnique.mockResolvedValue(MOCK_PRD_APPROVED);
      mockPrdUpdate.mockResolvedValue({ ...MOCK_PRD_APPROVED, status: "SUBMITTED" });
      mockProjectMemberFindUnique.mockResolvedValue(null); // PRD author

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
      mockProjectMemberFindUnique.mockResolvedValue(null); // PRD author

      await service.transition("prd_001", "user_author", "DRAFT");

      expect(mockPrdUpdate).toHaveBeenCalledWith({
        where: { id: "prd_001" },
        data: { status: "DRAFT" },
      });
    });
  });
});
