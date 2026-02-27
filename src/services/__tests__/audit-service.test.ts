/**
 * Audit Service tests.
 *
 * Tests for logTransition and getAuditTrail methods.
 * Uses mocked Prisma client.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockAuditEntryCreate = jest.fn();
const mockAuditEntryFindMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    auditEntry: {
      create: (...args: unknown[]) => mockAuditEntryCreate(...args),
      findMany: (...args: unknown[]) => mockAuditEntryFindMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AuditService } from "../audit-service";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AuditService", () => {
  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService();
  });

  describe("logTransition", () => {
    it("should create an audit entry with all fields", async () => {
      const mockEntry = {
        id: "audit_001",
        prdId: "prd_001",
        userId: "user_001",
        action: "STATUS_CHANGE",
        fromStatus: "DRAFT",
        toStatus: "IN_REVIEW",
        detail: { comment: "Ready for review" },
        createdAt: new Date(),
      };
      mockAuditEntryCreate.mockResolvedValue(mockEntry);

      await service.logTransition(
        "prd_001",
        "user_001",
        "STATUS_CHANGE",
        "DRAFT",
        "IN_REVIEW",
        { comment: "Ready for review" },
      );

      expect(mockAuditEntryCreate).toHaveBeenCalledWith({
        data: {
          prdId: "prd_001",
          userId: "user_001",
          action: "STATUS_CHANGE",
          fromStatus: "DRAFT",
          toStatus: "IN_REVIEW",
          detail: { comment: "Ready for review" },
        },
      });
    });

    it("should create an audit entry without optional fields", async () => {
      mockAuditEntryCreate.mockResolvedValue({
        id: "audit_002",
        prdId: "prd_001",
        userId: "user_001",
        action: "VIEWED",
        fromStatus: null,
        toStatus: null,
        detail: null,
        createdAt: new Date(),
      });

      await service.logTransition("prd_001", "user_001", "VIEWED");

      expect(mockAuditEntryCreate).toHaveBeenCalledWith({
        data: {
          prdId: "prd_001",
          userId: "user_001",
          action: "VIEWED",
          fromStatus: undefined,
          toStatus: undefined,
          detail: undefined,
        },
      });
    });
  });

  describe("getAuditTrail", () => {
    it("should return audit entries in chronological order", async () => {
      const entries = [
        {
          id: "audit_001",
          prdId: "prd_001",
          userId: "user_001",
          action: "CREATED",
          fromStatus: null,
          toStatus: "DRAFT",
          detail: null,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          user: { id: "user_001", name: "Author", email: "author@example.com" },
        },
        {
          id: "audit_002",
          prdId: "prd_001",
          userId: "user_001",
          action: "STATUS_CHANGE",
          fromStatus: "DRAFT",
          toStatus: "IN_REVIEW",
          detail: null,
          createdAt: new Date("2026-01-02T00:00:00Z"),
          user: { id: "user_001", name: "Author", email: "author@example.com" },
        },
      ];
      mockAuditEntryFindMany.mockResolvedValue(entries);

      const result = await service.getAuditTrail("prd_001");

      expect(result).toEqual(entries);
      expect(mockAuditEntryFindMany).toHaveBeenCalledWith({
        where: { prdId: "prd_001" },
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    it("should return empty array when no entries exist", async () => {
      mockAuditEntryFindMany.mockResolvedValue([]);

      const result = await service.getAuditTrail("prd_nonexistent");

      expect(result).toEqual([]);
    });
  });
});
