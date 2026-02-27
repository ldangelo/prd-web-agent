/**
 * Search service tests.
 *
 * Tests for OpenSearch integration service.
 * Mocks the OpenSearch client to avoid connecting to a real cluster.
 */

// ---------------------------------------------------------------------------
// Mock OpenSearch client
// ---------------------------------------------------------------------------

const mockIndex = jest.fn();
const mockSearch = jest.fn();
const mockDelete = jest.fn();

jest.mock("@opensearch-project/opensearch", () => ({
  Client: jest.fn().mockImplementation(() => ({
    index: mockIndex,
    search: mockSearch,
    delete: mockDelete,
  })),
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
    process.env.OPENSEARCH_URL = "http://localhost:9200";
    service = new SearchService();
  });

  afterEach(() => {
    delete process.env.OPENSEARCH_URL;
  });

  describe("indexPrd", () => {
    it("should call OpenSearch client index with correct parameters", async () => {
      mockIndex.mockResolvedValue({ body: { result: "created" } });

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

      expect(mockIndex).toHaveBeenCalledTimes(1);
      expect(mockIndex).toHaveBeenCalledWith({
        index: "prds",
        id: "prd_001",
        body: {
          title: "Test PRD",
          content: "This is the PRD content",
          projectId: "proj_001",
          authorId: "user_001",
          status: "DRAFT",
          tags: ["auth", "security"],
          version: 1,
          updatedAt: expect.any(String),
        },
        refresh: true,
      });
    });
  });

  describe("searchPrds", () => {
    it("should return search results with highlights", async () => {
      mockSearch.mockResolvedValue({
        body: {
          hits: {
            total: { value: 1 },
            hits: [
              {
                _id: "prd_001",
                _score: 1.5,
                _source: {
                  title: "Test PRD",
                  content: "This is the PRD content",
                  projectId: "proj_001",
                  authorId: "user_001",
                  status: "DRAFT",
                  tags: ["auth"],
                  version: 1,
                },
                highlight: {
                  title: ["<em>Test</em> PRD"],
                  content: ["This is the <em>PRD</em> content"],
                },
              },
            ],
          },
        },
      });

      const results = await service.searchPrds("Test");

      expect(mockSearch).toHaveBeenCalledTimes(1);
      expect(results.total).toBe(1);
      expect(results.hits).toHaveLength(1);
      expect(results.hits[0]).toEqual({
        id: "prd_001",
        score: 1.5,
        title: "Test PRD",
        content: "This is the PRD content",
        projectId: "proj_001",
        authorId: "user_001",
        status: "DRAFT",
        tags: ["auth"],
        version: 1,
        highlight: {
          title: ["<em>Test</em> PRD"],
          content: ["This is the <em>PRD</em> content"],
        },
      });
    });

    it("should pass filters to the search query", async () => {
      mockSearch.mockResolvedValue({
        body: {
          hits: {
            total: { value: 0 },
            hits: [],
          },
        },
      });

      await service.searchPrds("test", {
        projectId: "proj_001",
        status: "DRAFT",
        from: "2026-01-01",
        to: "2026-12-31",
      });

      expect(mockSearch).toHaveBeenCalledTimes(1);
      const searchArgs = mockSearch.mock.calls[0][0];
      expect(searchArgs.body.query.bool.filter).toEqual(
        expect.arrayContaining([
          { term: { projectId: "proj_001" } },
          { term: { status: "DRAFT" } },
          {
            range: {
              updatedAt: {
                gte: "2026-01-01",
                lte: "2026-12-31",
              },
            },
          },
        ]),
      );
    });

    it("should return empty results when no matches", async () => {
      mockSearch.mockResolvedValue({
        body: {
          hits: {
            total: { value: 0 },
            hits: [],
          },
        },
      });

      const results = await service.searchPrds("nonexistent");

      expect(results.total).toBe(0);
      expect(results.hits).toHaveLength(0);
    });
  });

  describe("deletePrdIndex", () => {
    it("should call OpenSearch client delete with correct parameters", async () => {
      mockDelete.mockResolvedValue({ body: { result: "deleted" } });

      await service.deletePrdIndex("prd_001");

      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledWith({
        index: "prds",
        id: "prd_001",
      });
    });
  });
});
