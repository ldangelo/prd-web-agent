/**
 * Submission Pipeline Service tests.
 *
 * Tests for sequential execution of submission steps (Confluence, Jira,
 * Git, Beads), partial failure handling, retry logic, artifact link
 * storage, and PRD status transition to SUBMITTED.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockPrdFindUnique = jest.fn();
const mockPrdUpdate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findUnique: (...args: unknown[]) => mockPrdFindUnique(...args),
      update: (...args: unknown[]) => mockPrdUpdate(...args),
    },
  },
}));

const mockResolveIntegrationConfig = jest.fn();
jest.mock("../integration-config-service", () => ({
  resolveIntegrationConfig: (...args: unknown[]) =>
    mockResolveIntegrationConfig(...args),
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

import { SubmissionPipelineService } from "../submission-pipeline-service";
import type { IntegrationConfig } from "../integrations/types";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_PRD_APPROVED = {
  id: "prd_001",
  title: "Test PRD",
  authorId: "user_author",
  projectId: "proj_001",
  status: "APPROVED",
  confluencePageId: null,
  jiraEpicKey: null,
  gitPrUrl: null,
  beadsIssueId: null,
};

const MOCK_CONFIG: IntegrationConfig = {
  confluenceSpace: "SPACE",
  confluenceToken: "token",
  jiraProject: "PROJ",
  jiraToken: "token",
  gitRepo: "org/repo",
  gitToken: "token",
  beadsProject: "beads-proj",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SubmissionPipelineService", () => {
  let service: SubmissionPipelineService;
  let mockExecutors: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockExecutors = {
      confluence: jest.fn().mockResolvedValue("CONF-12345"),
      jira: jest.fn().mockResolvedValue("PROJ-100"),
      git: jest.fn().mockResolvedValue("https://github.com/org/repo/pull/42"),
      beads: jest.fn().mockResolvedValue("BEADS-001"),
    };

    service = new SubmissionPipelineService(mockExecutors);

    mockPrdFindUnique.mockResolvedValue(MOCK_PRD_APPROVED);
    mockPrdUpdate.mockResolvedValue({
      ...MOCK_PRD_APPROVED,
      status: "SUBMITTED",
    });
    mockResolveIntegrationConfig.mockResolvedValue(MOCK_CONFIG);
    mockLogTransition.mockResolvedValue(undefined);
  });

  // -----------------------------------------------------------------------
  // execute - full pipeline
  // -----------------------------------------------------------------------

  describe("execute", () => {
    it("should execute all 4 steps sequentially and return success", async () => {
      const steps = await service.execute("prd_001", "user_author");

      expect(steps).toHaveLength(4);
      expect(steps[0]).toMatchObject({
        name: "confluence",
        status: "success",
        artifactLink: "CONF-12345",
      });
      expect(steps[1]).toMatchObject({
        name: "jira",
        status: "success",
        artifactLink: "PROJ-100",
      });
      expect(steps[2]).toMatchObject({
        name: "git",
        status: "success",
        artifactLink: "https://github.com/org/repo/pull/42",
      });
      expect(steps[3]).toMatchObject({
        name: "beads",
        status: "success",
        artifactLink: "BEADS-001",
      });
    });

    it("should execute steps in order: confluence, jira, git, beads", async () => {
      const callOrder: string[] = [];
      mockExecutors.confluence.mockImplementation(async () => {
        callOrder.push("confluence");
        return "CONF-12345";
      });
      mockExecutors.jira.mockImplementation(async () => {
        callOrder.push("jira");
        return "PROJ-100";
      });
      mockExecutors.git.mockImplementation(async () => {
        callOrder.push("git");
        return "https://github.com/org/repo/pull/42";
      });
      mockExecutors.beads.mockImplementation(async () => {
        callOrder.push("beads");
        return "BEADS-001";
      });

      await service.execute("prd_001", "user_author");

      expect(callOrder).toEqual(["confluence", "jira", "git", "beads"]);
    });

    it("should transition PRD to SUBMITTED when all steps succeed", async () => {
      await service.execute("prd_001", "user_author");

      expect(mockPrdUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prd_001" },
          data: expect.objectContaining({
            status: "SUBMITTED",
          }),
        }),
      );
    });

    it("should store artifact links on the PRD when all steps succeed", async () => {
      await service.execute("prd_001", "user_author");

      expect(mockPrdUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prd_001" },
          data: expect.objectContaining({
            confluencePageId: "CONF-12345",
            jiraEpicKey: "PROJ-100",
            gitPrUrl: "https://github.com/org/repo/pull/42",
            beadsIssueId: "BEADS-001",
          }),
        }),
      );
    });

    it("should log an audit entry when pipeline completes successfully", async () => {
      await service.execute("prd_001", "user_author");

      expect(mockLogTransition).toHaveBeenCalledWith(
        "prd_001",
        "user_author",
        "SUBMISSION_COMPLETE",
        "APPROVED",
        "SUBMITTED",
        expect.objectContaining({
          steps: expect.arrayContaining([
            expect.objectContaining({ name: "confluence", status: "success" }),
          ]),
        }),
      );
    });

    it("should throw NotFoundError when PRD does not exist", async () => {
      mockPrdFindUnique.mockResolvedValue(null);

      await expect(
        service.execute("prd_999", "user_author"),
      ).rejects.toThrow("PRD not found");
    });

    it("should throw ApiError when PRD is not in APPROVED status", async () => {
      mockPrdFindUnique.mockResolvedValue({
        ...MOCK_PRD_APPROVED,
        status: "DRAFT",
      });

      await expect(
        service.execute("prd_001", "user_author"),
      ).rejects.toThrow("PRD must be in APPROVED status to submit");
    });
  });

  // -----------------------------------------------------------------------
  // execute - partial failure
  // -----------------------------------------------------------------------

  describe("partial failure", () => {
    it("should preserve successful steps when a later step fails", async () => {
      mockExecutors.git.mockRejectedValue(new Error("Git API timeout"));

      const steps = await service.execute("prd_001", "user_author");

      expect(steps[0]).toMatchObject({
        name: "confluence",
        status: "success",
        artifactLink: "CONF-12345",
      });
      expect(steps[1]).toMatchObject({
        name: "jira",
        status: "success",
        artifactLink: "PROJ-100",
      });
      expect(steps[2]).toMatchObject({
        name: "git",
        status: "failed",
        error: "Git API timeout",
      });
      expect(steps[3]).toMatchObject({
        name: "beads",
        status: "pending",
      });
    });

    it("should not transition to SUBMITTED on partial failure", async () => {
      mockExecutors.jira.mockRejectedValue(new Error("Jira down"));

      await service.execute("prd_001", "user_author");

      // Should still update artifact links for successful steps
      expect(mockPrdUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            confluencePageId: "CONF-12345",
          }),
        }),
      );

      // But status should NOT be SUBMITTED
      const updateCall = mockPrdUpdate.mock.calls[0][0];
      expect(updateCall.data.status).toBeUndefined();
    });

    it("should stop execution after a failed step", async () => {
      mockExecutors.confluence.mockRejectedValue(
        new Error("Confluence unavailable"),
      );

      await service.execute("prd_001", "user_author");

      expect(mockExecutors.confluence).toHaveBeenCalled();
      expect(mockExecutors.jira).not.toHaveBeenCalled();
      expect(mockExecutors.git).not.toHaveBeenCalled();
      expect(mockExecutors.beads).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // retryStep
  // -----------------------------------------------------------------------

  describe("retryStep", () => {
    it("should only re-execute the specified failed step", async () => {
      // First run: git fails
      mockExecutors.git.mockRejectedValueOnce(new Error("Git timeout"));
      await service.execute("prd_001", "user_author");

      // Reset the mock call counts
      jest.clearAllMocks();
      mockPrdFindUnique.mockResolvedValue({
        ...MOCK_PRD_APPROVED,
        confluencePageId: "CONF-12345",
        jiraEpicKey: "PROJ-100",
      });
      mockResolveIntegrationConfig.mockResolvedValue(MOCK_CONFIG);
      mockExecutors.git.mockResolvedValue(
        "https://github.com/org/repo/pull/42",
      );
      mockPrdUpdate.mockResolvedValue({});

      const result = await service.retryStep("prd_001", "git", "user_author");

      expect(result).toMatchObject({
        name: "git",
        status: "success",
        artifactLink: "https://github.com/org/repo/pull/42",
      });
      expect(mockExecutors.confluence).not.toHaveBeenCalled();
      expect(mockExecutors.jira).not.toHaveBeenCalled();
      expect(mockExecutors.git).toHaveBeenCalled();
      expect(mockExecutors.beads).not.toHaveBeenCalled();
    });

    it("should update the artifact link on successful retry", async () => {
      mockExecutors.git.mockResolvedValue(
        "https://github.com/org/repo/pull/42",
      );
      mockPrdUpdate.mockResolvedValue({});

      await service.retryStep("prd_001", "git", "user_author");

      expect(mockPrdUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prd_001" },
          data: expect.objectContaining({
            gitPrUrl: "https://github.com/org/repo/pull/42",
          }),
        }),
      );
    });

    it("should return failed status when retry fails", async () => {
      mockExecutors.jira.mockRejectedValue(new Error("Still down"));
      mockPrdUpdate.mockResolvedValue({});

      const result = await service.retryStep(
        "prd_001",
        "jira",
        "user_author",
      );

      expect(result).toMatchObject({
        name: "jira",
        status: "failed",
        error: "Still down",
      });
    });

    it("should throw for invalid step name", async () => {
      await expect(
        service.retryStep("prd_001", "invalid" as any, "user_author"),
      ).rejects.toThrow("Invalid step name");
    });
  });

  // -----------------------------------------------------------------------
  // updateArtifacts
  // -----------------------------------------------------------------------

  describe("updateArtifacts", () => {
    it("should update PRD with artifact links from successful steps", async () => {
      mockPrdUpdate.mockResolvedValue({});

      await service.updateArtifacts("prd_001", [
        {
          name: "confluence",
          status: "success",
          artifactLink: "CONF-12345",
        },
        { name: "jira", status: "success", artifactLink: "PROJ-100" },
        {
          name: "git",
          status: "failed",
          error: "timeout",
        },
        { name: "beads", status: "pending" },
      ]);

      expect(mockPrdUpdate).toHaveBeenCalledWith({
        where: { id: "prd_001" },
        data: {
          confluencePageId: "CONF-12345",
          jiraEpicKey: "PROJ-100",
        },
      });
    });

    it("should not update when no successful steps have artifact links", async () => {
      await service.updateArtifacts("prd_001", [
        { name: "confluence", status: "failed", error: "down" },
        { name: "jira", status: "pending" },
        { name: "git", status: "pending" },
        { name: "beads", status: "pending" },
      ]);

      expect(mockPrdUpdate).not.toHaveBeenCalled();
    });
  });
});
