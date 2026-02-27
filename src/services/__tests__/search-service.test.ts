/**
 * Search service tests.
 *
 * Tests for PostgreSQL full-text search service.
 * Mocks prisma.$queryRaw and prisma.$executeRaw to avoid a real database.
 */

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

const mockQueryRaw = jest.fn();
const mockExecuteRaw = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { SearchService } from "../search-service";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SearchService", () => {
  let service: SearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchService();
  });

  describe("indexPrd", () => {
    it("should execute a raw SQL UPDATE to set the search_vector", async () => {
      mockExecuteRaw.mockResolvedValue(1);

      await service.indexPrd({
        prdId: "prd_001",
        title: "Test PRD",
        content: "This is the PRD content",
        projectId: "proj_001",
        authorId: "user_001",
        status: "DRAFT",
        tags: ["auth", "security"],
        version: 1,
      });

      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
      // Verify the tagged template literal was called (Prisma.sql / $executeRaw`...`)
      const callArgs = mockExecuteRaw.mock.calls[0];
      // The first argument to a tagged template is a TemplateStringsArray
      expect(callArgs[0]).toBeDefined();
    });

    it("should handle empty tags array", async () => {
      mockExecuteRaw.mockResolvedValue(1);

      await service.indexPrd({
        prdId: "prd_001",
        title: "Test PRD",
        content: "Content",
        projectId: "proj_001",
        authorId: "user_001",
        status: "DRAFT",
        tags: [],
        version: 1,
      });

      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe("searchPrds", () => {
    it("should return search results with highlights", async () => {
      mockQueryRaw.mockResolvedValue([
        {
          id: "prd_001",
          title: "Test PRD",
          status: "DRAFT",
          projectId: "proj_001",
          authorId: "user_001",
          tags: ["auth"],
          version: 1,
          score: 1.5,
          highlight: "This is the <b>PRD</b> content",
        },
      ]);

      const results = await service.searchPrds("Test");

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
      expect(results.total).toBe(1);
      expect(results.hits).toHaveLength(1);
      expect(results.hits[0]).toEqual({
        id: "prd_001",
        score: 1.5,
        title: "Test PRD",
        content: "",
        projectId: "proj_001",
        authorId: "user_001",
        status: "DRAFT",
        tags: ["auth"],
        version: 1,
        highlight: {
          content: ["This is the <b>PRD</b> content"],
        },
      });
    });

    it("should pass projectId filter to the search query", async () => {
      mockQueryRaw.mockResolvedValue([]);

      await service.searchPrds("test", { projectId: "proj_001" });

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });

    it("should pass status filter to the search query", async () => {
      mockQueryRaw.mockResolvedValue([]);

      await service.searchPrds("test", { status: "DRAFT" });

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });

    it("should pass date range filters to the search query", async () => {
      mockQueryRaw.mockResolvedValue([]);

      await service.searchPrds("test", {
        from: "2026-01-01",
        to: "2026-12-31",
      });

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });

    it("should pass all filters combined", async () => {
      mockQueryRaw.mockResolvedValue([]);

      await service.searchPrds("test", {
        projectId: "proj_001",
        status: "DRAFT",
        from: "2026-01-01",
        to: "2026-12-31",
      });

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });

    it("should return empty results when no matches", async () => {
      mockQueryRaw.mockResolvedValue([]);

      const results = await service.searchPrds("nonexistent");

      expect(results.total).toBe(0);
      expect(results.hits).toHaveLength(0);
    });

    it("should handle null highlight gracefully", async () => {
      mockQueryRaw.mockResolvedValue([
        {
          id: "prd_002",
          title: "Another PRD",
          status: "DRAFT",
          projectId: "proj_001",
          authorId: "user_001",
          tags: [],
          version: 1,
          score: 0.8,
          highlight: null,
        },
      ]);

      const results = await service.searchPrds("another");

      expect(results.hits[0].highlight).toBeUndefined();
    });
  });

  describe("deletePrdIndex", () => {
    it("should be a no-op (tsvector is deleted with the row)", async () => {
      // deletePrdIndex is a no-op since the search vector lives on the PRD row
      await service.deletePrdIndex("prd_001");

      // No database calls should be made
      expect(mockExecuteRaw).not.toHaveBeenCalled();
      expect(mockQueryRaw).not.toHaveBeenCalled();
    });
  });

  describe("ensureSearchIndex", () => {
    it("should create the tsvector column and GIN index", async () => {
      mockExecuteRaw.mockResolvedValue(undefined);

      await SearchService.ensureSearchIndex();

      // Should be called twice: once for ALTER TABLE, once for CREATE INDEX
      expect(mockExecuteRaw).toHaveBeenCalledTimes(2);
    });
  });
});
