/**
 * Submission Pipeline Service tests.
 *
 * Tests for sequential execution of the GitHub submission step,
 * partial failure handling, retry logic, artifact link
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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_PRD_APPROVED = {
  id: "prd_001",
  title: "Test PRD",
  authorId: "user_author",
  projectId: "proj_001",
  status: "APPROVED",
  githubPrUrl: null,
  githubPrNumber: null,
  githubBranch: null,
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
      github: jest.fn().mockResolvedValue("https://github.com/org/repo/pull/42"),
    };

    service = new SubmissionPipelineService(mockExecutors);

    mockPrdFindUnique.mockResolvedValue(MOCK_PRD_APPROVED);
    mockPrdUpdate.mockResolvedValue({
      ...MOCK_PRD_APPROVED,
      status: "SUBMITTED",
    });
    mockLogTransition.mockResolvedValue(undefined);
  });

  // -----------------------------------------------------------------------
  // execute - full pipeline
  // -----------------------------------------------------------------------

  describe("execute", () => {
    it("should execute the github step and return success", async () => {
      const steps = await service.execute("prd_001", "user_author");

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        name: "github",
        status: "success",
        artifactLink: "https://github.com/org/repo/pull/42",
      });
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
            githubPrUrl: "https://github.com/org/repo/pull/42",
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
            expect.objectContaining({ name: "github", status: "success" }),
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
  // execute - failure
  // -----------------------------------------------------------------------

  describe("failure", () => {
    it("should not transition to SUBMITTED on failure", async () => {
      mockExecutors.github.mockRejectedValue(new Error("GitHub API timeout"));

      const steps = await service.execute("prd_001", "user_author");

      expect(steps[0]).toMatchObject({
        name: "github",
        status: "failed",
        error: "GitHub API timeout",
      });

      // Should not update PRD (no successful artifacts)
      expect(mockPrdUpdate).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // retryStep
  // -----------------------------------------------------------------------

  describe("retryStep", () => {
    it("should only re-execute the specified failed step", async () => {
      // First run: github fails
      mockExecutors.github.mockRejectedValueOnce(new Error("GitHub timeout"));
      await service.execute("prd_001", "user_author");

      // Reset the mock call counts
      jest.clearAllMocks();
      mockPrdFindUnique.mockResolvedValue({
        ...MOCK_PRD_APPROVED,
      });
      mockExecutors.github.mockResolvedValue(
        "https://github.com/org/repo/pull/42",
      );
      mockPrdUpdate.mockResolvedValue({});

      const result = await service.retryStep("prd_001", "github", "user_author");

      expect(result).toMatchObject({
        name: "github",
        status: "success",
        artifactLink: "https://github.com/org/repo/pull/42",
      });
      expect(mockExecutors.github).toHaveBeenCalled();
    });

    it("should update the artifact link on successful retry", async () => {
      mockExecutors.github.mockResolvedValue(
        "https://github.com/org/repo/pull/42",
      );
      mockPrdUpdate.mockResolvedValue({});

      await service.retryStep("prd_001", "github", "user_author");

      expect(mockPrdUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prd_001" },
          data: expect.objectContaining({
            githubPrUrl: "https://github.com/org/repo/pull/42",
          }),
        }),
      );
    });

    it("should return failed status when retry fails", async () => {
      mockExecutors.github.mockRejectedValue(new Error("Still down"));
      mockPrdUpdate.mockResolvedValue({});

      const result = await service.retryStep(
        "prd_001",
        "github",
        "user_author",
      );

      expect(result).toMatchObject({
        name: "github",
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
          name: "github",
          status: "success",
          artifactLink: "https://github.com/org/repo/pull/42",
        },
      ]);

      expect(mockPrdUpdate).toHaveBeenCalledWith({
        where: { id: "prd_001" },
        data: {
          githubPrUrl: "https://github.com/org/repo/pull/42",
        },
      });
    });

    it("should not update when no successful steps have artifact links", async () => {
      await service.updateArtifacts("prd_001", [
        { name: "github", status: "failed", error: "down" },
      ]);

      expect(mockPrdUpdate).not.toHaveBeenCalled();
    });
  });
});
