/**
 * OpenSearch search service for PRD full-text search.
 *
 * Provides indexing, searching, and deletion of PRD documents
 * in an OpenSearch cluster for fast full-text search with
 * fuzzy matching and relevance ranking.
 */
import { Client } from "@opensearch-project/opensearch";

const PRD_INDEX = "prds";

export interface IndexPrdParams {
  prdId: string;
  title: string;
  content: string;
  projectId: string;
  authorId: string;
  status: string;
  tags: string[];
  version: number;
}

export interface SearchFilters {
  projectId?: string;
  status?: string;
  from?: string;
  to?: string;
}

export interface SearchHit {
  id: string;
  score: number;
  title: string;
  content: string;
  projectId: string;
  authorId: string;
  status: string;
  tags: string[];
  version: number;
  highlight?: Record<string, string[]>;
}

export interface SearchResult {
  total: number;
  hits: SearchHit[];
}

export class SearchService {
  private client: Client;

  constructor() {
    this.client = new Client({
      node: process.env.OPENSEARCH_URL || "http://localhost:9200",
    });
  }

  /**
   * Index or update a PRD document in OpenSearch.
   */
  async indexPrd(params: IndexPrdParams): Promise<void> {
    await this.client.index({
      index: PRD_INDEX,
      id: params.prdId,
      body: {
        title: params.title,
        content: params.content,
        projectId: params.projectId,
        authorId: params.authorId,
        status: params.status,
        tags: params.tags,
        version: params.version,
        updatedAt: new Date().toISOString(),
      },
      refresh: true,
    });
  }

  /**
   * Full-text search across PRD documents with optional filters.
   *
   * Uses multi_match with fuzziness for typo tolerance and
   * highlights matching fragments in title and content fields.
   */
  async searchPrds(
    query: string,
    filters?: SearchFilters,
  ): Promise<SearchResult> {
    const must = [
      {
        multi_match: {
          query,
          fields: ["title^3", "content", "tags^2"],
          fuzziness: "AUTO",
          type: "best_fields",
        },
      },
    ];

    const filter: Record<string, unknown>[] = [];

    if (filters?.projectId) {
      filter.push({ term: { projectId: filters.projectId } });
    }
    if (filters?.status) {
      filter.push({ term: { status: filters.status } });
    }
    if (filters?.from || filters?.to) {
      const range: Record<string, string> = {};
      if (filters.from) range.gte = filters.from;
      if (filters.to) range.lte = filters.to;
      filter.push({ range: { updatedAt: range } });
    }

    const response = await this.client.search({
      index: PRD_INDEX,
      body: {
        query: {
          bool: {
            must,
            filter,
          },
        },
        highlight: {
          fields: {
            title: {},
            content: { fragment_size: 200 },
          },
        },
      },
    });

    const hits = response.body.hits;
    return {
      total: hits.total.value,
      hits: hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        title: hit._source.title,
        content: hit._source.content,
        projectId: hit._source.projectId,
        authorId: hit._source.authorId,
        status: hit._source.status,
        tags: hit._source.tags,
        version: hit._source.version,
        highlight: hit.highlight,
      })),
    };
  }

  /**
   * Remove a PRD document from the search index.
   */
  async deletePrdIndex(prdId: string): Promise<void> {
    await this.client.delete({
      index: PRD_INDEX,
      id: prdId,
    });
  }
}
