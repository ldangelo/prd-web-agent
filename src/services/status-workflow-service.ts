/**
 * Status Workflow Service.
 *
 * Implements a state machine for PRD status transitions with:
 * - Transition validation (only allowed paths)
 * - Authorization checks using project-level roles (ProjectMember.role)
 *   SUBMITTER → can submit DRAFT→IN_REVIEW
 *   APPROVER  → can approve/reject (IN_REVIEW→APPROVED or IN_REVIEW→DRAFT)
 *   project ADMIN → can do anything a project admin needs
 *   System ADMIN  → overrides all checks
 * - Reviewer auto-assignment notifications on IN_REVIEW (TASK-028)
 * - Unresolved comment blocking on APPROVED (TASK-031)
 * - Audit trail logging on every transition (TASK-034)
 */
import { prisma } from "@/lib/prisma";
import { AuditService } from "./audit-service";
import {
  ApiError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "@/lib/api/errors";

/**
 * The valid PRD status values, matching the Prisma enum.
 */
export type PrdStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "SUBMITTED";

/**
 * Defines the allowed transitions from each status.
 *
 * DRAFT       -> IN_REVIEW
 * IN_REVIEW   -> APPROVED | DRAFT (rejection, requires comment)
 * APPROVED    -> SUBMITTED | DRAFT (re-open)
 * SUBMITTED   -> DRAFT (re-open for refinement)
 */
const TRANSITIONS: Record<PrdStatus, PrdStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["SUBMITTED", "DRAFT"],
  SUBMITTED: ["DRAFT"],
};

export class StatusWorkflowService {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  /**
   * Get the list of valid target statuses from a given current status.
   */
  getValidTransitions(currentStatus: PrdStatus): PrdStatus[] {
    return TRANSITIONS[currentStatus] ?? [];
  }

  /**
   * Check whether a transition from one status to another is allowed.
   */
  isValidTransition(from: PrdStatus, to: PrdStatus): boolean {
    return (TRANSITIONS[from] ?? []).includes(to);
  }

  /**
   * Execute a status transition on a PRD.
   *
   * Validates the transition, checks authorization, enforces business
   * rules (comment required for rejection, unresolved comment blocking),
   * updates the status, notifies reviewers, and logs an audit entry.
   *
   * @param prdId - The PRD to transition
   * @param userId - The user performing the transition
   * @param toStatus - The target status
   * @param comment - Optional comment (required for rejection)
   * @throws NotFoundError if PRD does not exist
   * @throws ApiError (422) if the transition is invalid
   * @throws ForbiddenError if the user lacks permission
   * @throws ValidationError if a comment is required but missing
   * @throws ApiError (409) if unresolved comments block approval
   */
  async transition(
    prdId: string,
    userId: string,
    toStatus: PrdStatus,
    comment?: string,
  ): Promise<void> {
    // 1. Fetch the PRD
    const prd = await prisma.prd.findUnique({ where: { id: prdId } });
    if (!prd) {
      throw new NotFoundError("PRD not found");
    }

    const fromStatus = prd.status as PrdStatus;

    // 2. Validate the transition
    if (!this.isValidTransition(fromStatus, toStatus)) {
      throw new ApiError(
        `Invalid status transition from ${fromStatus} to ${toStatus}`,
        422,
      );
    }

    // 3. Fetch the acting user and their project membership
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const systemRole = user?.role;
    const isSystemAdmin = systemRole === "ADMIN";

    // 4. Fetch project membership for project-level role checks
    const membership = isSystemAdmin
      ? null
      : await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: prd.projectId, userId } },
        });
    const projectRole = membership?.role ?? null;

    // 5. Authorization checks
    await this.checkAuthorization(prd, userId, isSystemAdmin, projectRole, fromStatus, toStatus);

    // 6. Rejection requires a comment
    if (fromStatus === "IN_REVIEW" && toStatus === "DRAFT" && !comment) {
      throw new ValidationError("Comment is required when rejecting a PRD");
    }

    // 7. TASK-031: Check unresolved comments when approving
    if (toStatus === "APPROVED") {
      await this.checkUnresolvedComments(prdId);
    }

    // 8. Update the status
    await prisma.prd.update({
      where: { id: prdId },
      data: { status: toStatus },
    });

    // 9. TASK-028: Notify reviewers when entering IN_REVIEW
    if (toStatus === "IN_REVIEW") {
      await this.notifyReviewers(prd.projectId, prdId, prd.title);
    }

    // 10. TASK-034: Log audit entry
    await this.auditService.logTransition(
      prdId,
      userId,
      "STATUS_CHANGE",
      fromStatus,
      toStatus,
      comment ? { comment } : undefined,
    );
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Verify the user has permission to perform the requested transition.
   *
   * Authorization matrix:
   *   DRAFT → IN_REVIEW:   PRD author, co-author, project SUBMITTER/ADMIN, system ADMIN
   *   IN_REVIEW → APPROVED: project APPROVER/ADMIN, system ADMIN
   *   IN_REVIEW → DRAFT:   project APPROVER/ADMIN, system ADMIN (rejection)
   *   APPROVED → SUBMITTED: PRD author, co-author, project ADMIN, system ADMIN
   *   APPROVED → DRAFT:    PRD author, co-author, project ADMIN, system ADMIN
   *   SUBMITTED → DRAFT:   PRD author, co-author, project ADMIN, system ADMIN
   */
  private async checkAuthorization(
    prd: { id: string; authorId: string; projectId: string },
    userId: string,
    isSystemAdmin: boolean,
    projectRole: string | null,
    fromStatus: PrdStatus,
    toStatus: PrdStatus,
  ): Promise<void> {
    // System admins can always perform valid transitions
    if (isSystemAdmin) return;

    // DRAFT -> IN_REVIEW: author, co-author, project SUBMITTER or project ADMIN
    if (fromStatus === "DRAFT" && toStatus === "IN_REVIEW") {
      if (projectRole === "SUBMITTER" || projectRole === "ADMIN") return;
      const isAuthor = prd.authorId === userId;
      if (isAuthor) return;
      const coAuthor = await prisma.prdCoAuthor.findFirst({
        where: { prdId: prd.id, userId },
      });
      if (coAuthor) return;
      throw new ForbiddenError(
        "Only the author, co-authors, or project submitters can submit for review",
      );
    }

    // IN_REVIEW -> APPROVED: project APPROVER or project ADMIN
    if (fromStatus === "IN_REVIEW" && toStatus === "APPROVED") {
      if (projectRole === "APPROVER" || projectRole === "ADMIN") return;
      throw new ForbiddenError("Only project approvers or admins can approve");
    }

    // IN_REVIEW -> DRAFT (rejection): project APPROVER or project ADMIN
    if (fromStatus === "IN_REVIEW" && toStatus === "DRAFT") {
      if (projectRole === "APPROVER" || projectRole === "ADMIN") return;
      throw new ForbiddenError("Only project approvers or admins can reject");
    }

    // APPROVED -> SUBMITTED or APPROVED -> DRAFT or SUBMITTED -> DRAFT:
    // author, co-author, or project ADMIN
    if (fromStatus === "APPROVED" || fromStatus === "SUBMITTED") {
      if (projectRole === "ADMIN") return;
      const isAuthor = prd.authorId === userId;
      if (isAuthor) return;
      const coAuthor = await prisma.prdCoAuthor.findFirst({
        where: { prdId: prd.id, userId },
      });
      if (coAuthor) return;
      throw new ForbiddenError("Insufficient permissions for this transition");
    }
  }

  /**
   * TASK-031: Check if unresolved comments should block approval.
   */
  private async checkUnresolvedComments(prdId: string): Promise<void> {
    const settings = await prisma.globalSettings.findUnique({
      where: { id: "global" },
    });

    // If settings don't exist or blocking is disabled, allow
    if (!settings?.blockApprovalOnUnresolvedComments) return;

    const unresolvedCount = await prisma.comment.count({
      where: { prdId, resolved: false },
    });

    if (unresolvedCount > 0) {
      throw new ApiError(
        `Cannot approve: ${unresolvedCount} unresolved comment(s) remain`,
        409,
      );
    }
  }

  /**
   * TASK-028: Notify project reviewers when a PRD enters review.
   */
  private async notifyReviewers(
    projectId: string,
    prdId: string,
    prdTitle: string,
  ): Promise<void> {
    const reviewers = await prisma.projectMember.findMany({
      where: {
        projectId,
        role: { in: ["REVIEWER", "APPROVER", "ADMIN"] },
      },
    });

    if (reviewers.length === 0) return;

    await prisma.notification.createMany({
      data: reviewers.map((r) => ({
        userId: r.userId,
        prdId,
        type: "REVIEW_REQUESTED",
        message: `PRD "${prdTitle}" has been submitted for review`,
      })),
    });
  }
}
