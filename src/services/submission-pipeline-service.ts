/**
 * Submission Pipeline Service.
 *
 * Orchestrates PRD submission to GitHub: creates a branch, commits the
 * PRD markdown, and opens a pull request using the user's OAuth token.
 * Stores artifact links (githubPrUrl, githubPrNumber, githubBranch)
 * on the PRD record and transitions status to SUBMITTED.
 */
import { prisma } from "@/lib/prisma";
import { AuditService } from "./audit-service";
import { NotFoundError, ApiError } from "@/lib/api/errors";
import { GitHubSubmissionService } from "./github-submission-service";
import type { SubmissionStep } from "./integrations/types";

const STEP_NAMES = ["github"] as const;
type StepName = (typeof STEP_NAMES)[number];

/** Maps step name to PRD field for artifact link storage. */
const ARTIFACT_FIELD_MAP: Record<StepName, string> = {
  github: "githubPrUrl",
};

export class SubmissionPipelineService {
  private githubService: GitHubSubmissionService;
  private auditService: AuditService;
  /** In-memory cache of step statuses keyed by PRD ID. */
  private stepCache: Map<string, SubmissionStep[]> = new Map();

  constructor(
    executors?: Record<string, (prdId: string, config: any) => Promise<string>>,
    githubService?: GitHubSubmissionService,
  ) {
    this.githubService = githubService ?? new GitHubSubmissionService();
    this.auditService = new AuditService();

    // Legacy executor support for backward compatibility in tests
    if (executors) {
      this._legacyExecutors = executors;
    }
  }

  private _legacyExecutors?: Record<string, (prdId: string, config: any) => Promise<string>>;

  /**
   * Execute the full submission pipeline.
   *
   * Retrieves the user's GitHub OAuth token from the Account table,
   * fetches the project's repo config, and delegates to GitHubSubmissionService.
   */
  async execute(prdId: string, userId: string): Promise<SubmissionStep[]> {
    const prd = await prisma.prd.findUnique({
      where: { id: prdId },
      include: {
        project: true,
        versions: {
          orderBy: { version: "desc" as const },
          take: 1,
        },
      },
    });
    if (!prd) throw new NotFoundError("PRD not found");
    if (prd.status !== "APPROVED") {
      throw new ApiError("PRD must be in APPROVED status to submit", 422);
    }

    const steps: SubmissionStep[] = STEP_NAMES.map((name) => ({
      name,
      status: "pending" as const,
    }));

    let allSucceeded = true;

    // If legacy executors are provided (for test backward compat), use them
    if (this._legacyExecutors) {
      for (let i = 0; i < STEP_NAMES.length; i++) {
        const stepName = STEP_NAMES[i];
        const executor = this._legacyExecutors[stepName];

        if (!executor) {
          steps[i] = { name: stepName, status: "failed", error: `No executor for ${stepName}` };
          allSucceeded = false;
          break;
        }

        steps[i].status = "in_progress";

        try {
          const artifactLink = await executor(prdId, {});
          steps[i] = { name: stepName, status: "success", artifactLink };
        } catch (err) {
          steps[i] = {
            name: stepName,
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          };
          allSucceeded = false;
          break;
        }
      }
    } else {
      // Production path: use GitHubSubmissionService
      steps[0].status = "in_progress";

      try {
        // Get user's GitHub OAuth token
        const account = await prisma.account.findFirst({
          where: { userId, provider: "github" },
        });
        if (!account?.access_token) {
          throw new Error("No GitHub OAuth token found. Please connect your GitHub account.");
        }

        const prdContent = prd.versions?.[0]?.content ?? "";

        const result = await this.githubService.submit({
          githubToken: account.access_token,
          repoFullName: prd.project.githubRepo,
          prdId: prd.id,
          prdTitle: prd.title,
          prdContent,
          labels: prd.project.defaultLabels ?? [],
          reviewers: prd.project.defaultReviewers ?? [],
        });

        steps[0] = {
          name: "github",
          status: "success",
          artifactLink: result.prUrl,
        };
      } catch (err) {
        steps[0] = {
          name: "github",
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
        allSucceeded = false;
      }
    }

    // Cache step statuses
    this.stepCache.set(prdId, steps);

    if (allSucceeded) {
      // All succeeded: update artifacts AND transition status in one call
      const artifactData = this.buildArtifactData(steps);
      await prisma.prd.update({
        where: { id: prdId },
        data: {
          ...artifactData,
          status: "SUBMITTED",
        },
      });

      await this.auditService.logTransition(
        prdId,
        userId,
        "SUBMISSION_COMPLETE",
        "APPROVED",
        "SUBMITTED",
        { steps },
      );
    } else {
      // Partial success: only update artifact links (no status change)
      await this.updateArtifacts(prdId, steps);
    }

    return steps;
  }

  /**
   * Retry a single failed step.
   */
  async retryStep(
    prdId: string,
    stepName: string,
    userId: string,
  ): Promise<SubmissionStep> {
    if (!STEP_NAMES.includes(stepName as StepName)) {
      throw new ApiError("Invalid step name", 422);
    }

    const prd = await prisma.prd.findUnique({ where: { id: prdId } });
    if (!prd) throw new NotFoundError("PRD not found");

    if (this._legacyExecutors) {
      const executor = this._legacyExecutors[stepName];

      try {
        const artifactLink = await executor(prdId, {});

        const fieldName = ARTIFACT_FIELD_MAP[stepName as StepName];
        await prisma.prd.update({
          where: { id: prdId },
          data: { [fieldName]: artifactLink },
        });

        const result: SubmissionStep = { name: stepName as StepName, status: "success", artifactLink };

        const cachedSteps = this.stepCache.get(prdId);
        if (cachedSteps) {
          const idx = cachedSteps.findIndex((s) => s.name === stepName);
          if (idx >= 0) cachedSteps[idx] = result;
        }

        return result;
      } catch (err) {
        const result: SubmissionStep = {
          name: stepName as StepName,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };

        const cachedSteps = this.stepCache.get(prdId);
        if (cachedSteps) {
          const idx = cachedSteps.findIndex((s) => s.name === stepName);
          if (idx >= 0) cachedSteps[idx] = result;
        }

        return result;
      }
    }

    // Production retry path using GitHubSubmissionService
    try {
      const account = await prisma.account.findFirst({
        where: { userId, provider: "github" },
      });
      if (!account?.access_token) {
        throw new Error("No GitHub OAuth token found.");
      }

      const fullPrd = await prisma.prd.findUnique({
        where: { id: prdId },
        include: {
          project: true,
          versions: { orderBy: { version: "desc" as const }, take: 1 },
        },
      });

      if (!fullPrd) throw new NotFoundError("PRD not found");

      const prdContent = fullPrd.versions?.[0]?.content ?? "";

      const result = await this.githubService.submit({
        githubToken: account.access_token,
        repoFullName: fullPrd.project.githubRepo,
        prdId: fullPrd.id,
        prdTitle: fullPrd.title,
        prdContent,
        labels: fullPrd.project.defaultLabels ?? [],
        reviewers: fullPrd.project.defaultReviewers ?? [],
      });

      const fieldName = ARTIFACT_FIELD_MAP[stepName as StepName];
      await prisma.prd.update({
        where: { id: prdId },
        data: {
          [fieldName]: result.prUrl,
          githubPrNumber: result.prNumber,
          githubBranch: result.branch,
        },
      });

      const step: SubmissionStep = {
        name: stepName as StepName,
        status: "success",
        artifactLink: result.prUrl,
      };

      const cachedSteps = this.stepCache.get(prdId);
      if (cachedSteps) {
        const idx = cachedSteps.findIndex((s) => s.name === stepName);
        if (idx >= 0) cachedSteps[idx] = step;
      }

      return step;
    } catch (err) {
      const step: SubmissionStep = {
        name: stepName as StepName,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      };

      const cachedSteps = this.stepCache.get(prdId);
      if (cachedSteps) {
        const idx = cachedSteps.findIndex((s) => s.name === stepName);
        if (idx >= 0) cachedSteps[idx] = step;
      }

      return step;
    }
  }

  /**
   * Get the step statuses for a PRD.
   */
  async getStepStatuses(prdId: string): Promise<SubmissionStep[]> {
    const cached = this.stepCache.get(prdId);
    if (cached) return cached;

    const prd = await prisma.prd.findUnique({ where: { id: prdId } });
    if (!prd) throw new NotFoundError("PRD not found");

    return STEP_NAMES.map((name) => {
      const fieldName = ARTIFACT_FIELD_MAP[name];
      const value = (prd as Record<string, unknown>)[fieldName];
      if (value) {
        return { name, status: "success" as const, artifactLink: value as string };
      }
      return { name, status: "pending" as const };
    });
  }

  /**
   * Update PRD with artifact links from successful steps.
   */
  async updateArtifacts(
    prdId: string,
    steps: SubmissionStep[],
  ): Promise<void> {
    const data = this.buildArtifactData(steps);

    if (Object.keys(data).length > 0) {
      await prisma.prd.update({
        where: { id: prdId },
        data,
      });
    }
  }

  private buildArtifactData(
    steps: SubmissionStep[],
  ): Record<string, string> {
    const data: Record<string, string> = {};

    for (const step of steps) {
      if (step.status === "success" && step.artifactLink) {
        const field = ARTIFACT_FIELD_MAP[step.name as StepName];
        if (field) {
          data[field] = step.artifactLink;
        }
      }
    }

    return data;
  }
}
