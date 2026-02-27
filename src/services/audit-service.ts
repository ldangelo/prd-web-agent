/**
 * Audit Service.
 *
 * Records and retrieves audit trail entries for PRD lifecycle events.
 * Every status transition, comment, and significant action is logged
 * with the acting user, timestamp, and optional detail payload.
 */
import { prisma } from "@/lib/prisma";

export class AuditService {
  /**
   * Log a transition or action to the audit trail.
   *
   * @param prdId - The PRD this action relates to
   * @param userId - The user who performed the action
   * @param action - A short action identifier (e.g. "STATUS_CHANGE")
   * @param fromStatus - The previous status (optional)
   * @param toStatus - The new status (optional)
   * @param detail - Arbitrary JSON detail (optional)
   */
  async logTransition(
    prdId: string,
    userId: string,
    action: string,
    fromStatus?: string,
    toStatus?: string,
    detail?: unknown,
  ): Promise<void> {
    await prisma.auditEntry.create({
      data: {
        prdId,
        userId,
        action,
        fromStatus,
        toStatus,
        detail: detail as any,
      },
    });
  }

  /**
   * Retrieve the full audit trail for a PRD in chronological order.
   *
   * @param prdId - The PRD to retrieve the audit trail for
   * @returns Array of audit entries with user info, oldest first
   */
  async getAuditTrail(prdId: string) {
    return prisma.auditEntry.findMany({
      where: { prdId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
