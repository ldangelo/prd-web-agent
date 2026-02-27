/**
 * Submission Pipeline Service.
 *
 * Orchestrates sequential execution of submission steps
 * (Confluence, Jira, Git, Beads), handles partial failures,
 * stores artifact links on the PRD, and transitions to SUBMITTED.
 */
import { prisma } from "@/lib/prisma";
import { resolveIntegrationConfig } from "./integration-config-service";
import { AuditService } from "./audit-service";
import { NotFoundError, ApiError } from "@/lib/api/errors";
import type { SubmissionStep } from "./integrations/types";

const STEP_NAMES = ["confluence", "jira", "git", "beads"] as const;
type StepName = (typeof STEP_NAMES)[number];

/** Maps step name to PRD field for artifact link storage. */
const ARTIFACT_FIELD_MAP: Record<StepName, string> = {
  confluence: "confluencePageId",
  jira: "jiraEpicKey",
  git: "gitPrUrl",
  beads: "beadsIssueId",
};

export class SubmissionPipelineService {
  private executors: Record<string, (prdId: string, config: any) => Promise<string>>;
  private auditService: AuditService;
  /** In-memory cache of step statuses keyed by PRD ID. */
  private stepCache: Map<string, SubmissionStep[]> = new Map();

  constructor(
    executors?: Record<string, (prdId: string, config: any) => Promise<string>>,
  ) {
    this.executors = executors ?? {};
    this.auditService = new AuditService();
  }

  /**
   * Execute the full submission pipeline sequentially.
   * Stops on first failure; remaining steps stay pending.
   */
  async execute(prdId: string, userId: string): Promise<SubmissionStep[]> {
    const prd = await prisma.prd.findUnique({ where: { id: prdId } });
    if (!prd) throw new NotFoundError("PRD not found");
    if (prd.status !== "APPROVED") {
      throw new ApiError("PRD must be in APPROVED status to submit", 422);
    }

    const config = await resolveIntegrationConfig(prd.projectId);
    const steps: SubmissionStep[] = STEP_NAMES.map((name) => ({
      name,
      status: "pending" as const,
    }));

    let allSucceeded = true;

    for (let i = 0; i < STEP_NAMES.length; i++) {
      const stepName = STEP_NAMES[i];
      const executor = this.executors[stepName];

      if (!executor) {
        steps[i] = { name: stepName, status: "failed", error: `No executor for ${stepName}` };
        allSucceeded = false;
        break;
      }

      steps[i].status = "in_progress";

      try {
        const artifactLink = await executor(prdId, config);
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

    const config = await resolveIntegrationConfig(prd.projectId);
    const executor = this.executors[stepName];

    try {
      const artifactLink = await executor(prdId, config);

      // Update the artifact link on the PRD
      const fieldName = ARTIFACT_FIELD_MAP[stepName as StepName];
      await prisma.prd.update({
        where: { id: prdId },
        data: { [fieldName]: artifactLink },
      });

      const result: SubmissionStep = { name: stepName as StepName, status: "success", artifactLink };

      // Update cache
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

      // Update cache
      const cachedSteps = this.stepCache.get(prdId);
      if (cachedSteps) {
        const idx = cachedSteps.findIndex((s) => s.name === stepName);
        if (idx >= 0) cachedSteps[idx] = result;
      }

      return result;
    }
  }

  /**
   * Get the step statuses for a PRD.
   *
   * Returns cached statuses if available, otherwise derives
   * from the PRD record's artifact fields.
   */
  async getStepStatuses(prdId: string): Promise<SubmissionStep[]> {
    const cached = this.stepCache.get(prdId);
    if (cached) return cached;

    // Derive from PRD record
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
