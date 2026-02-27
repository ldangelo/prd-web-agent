/**
 * PostgreSQL full-text search service for PRD documents.
 *
 * Uses tsvector/tsquery with GIN index for fast full-text search.
 * Replaces the previous OpenSearch-based implementation while
 * maintaining the same public interface.
 */
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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

interface RawSearchRow {
  id: string;
  title: string;
  status: string;
  projectId: string;
  authorId: string;
  tags: string[];
  version: number;
  score: number;
  highlight: string | null;
}

export class SearchService {
  /**
   * Ensure the search_vector column and GIN index exist on the Prd table.
   * Idempotent - safe to call on every startup.
   */
  static async ensureSearchIndex(): Promise<void> {
    await prisma.$executeRaw`
      ALTER TABLE "Prd" ADD COLUMN IF NOT EXISTS search_vector tsvector;
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS prd_search_idx ON "Prd" USING GIN(search_vector);
    `;
  }

  /**
   * Update the tsvector search_vector column for a PRD.
   *
   * Weights: title=A, content=B, tags=C so that title matches
   * rank higher than body text which ranks higher than tags.
   */
  async indexPrd(params: IndexPrdParams): Promise<void> {
    const tagsText = params.tags.join(" ");

    await prisma.$executeRaw`
      UPDATE "Prd" SET search_vector =
        setweight(to_tsvector('english', ${params.title}), 'A') ||
        setweight(to_tsvector('english', ${params.content}), 'B') ||
        setweight(to_tsvector('english', ${tagsText}), 'C')
      WHERE id = ${params.prdId}
    `;
  }

  /**
   * Full-text search across PRD documents with optional filters.
   *
   * Uses plainto_tsquery for safe query parsing (no special syntax needed),
   * ts_rank for relevance scoring, and ts_headline for result highlighting.
   */
  async searchPrds(
    query: string,
    filters?: SearchFilters,
  ): Promise<SearchResult> {
    // Build dynamic WHERE clauses beyond the full-text match
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.search_vector @@ plainto_tsquery('english', ${query})`,
    ];

    if (filters?.projectId) {
      conditions.push(Prisma.sql`p."projectId" = ${filters.projectId}`);
    }
    if (filters?.status) {
      conditions.push(Prisma.sql`p.status::text = ${filters.status}`);
    }
    if (filters?.from) {
      conditions.push(Prisma.sql`p."updatedAt" >= ${new Date(filters.from)}`);
    }
    if (filters?.to) {
      conditions.push(Prisma.sql`p."updatedAt" <= ${new Date(filters.to)}`);
    }

    const whereClause = Prisma.join(conditions, " AND ");

    const rows = await prisma.$queryRaw<RawSearchRow[]>`
      SELECT
        p.id,
        p.title,
        p.status::text as status,
        p."projectId",
        p."authorId",
        p.tags,
        p."currentVersion" as version,
        ts_rank(p.search_vector, plainto_tsquery('english', ${query})) as score,
        ts_headline('english', v.content, plainto_tsquery('english', ${query}),
          'MaxFragments=1,MaxWords=30,MinWords=10') as highlight
      FROM "Prd" p
      JOIN "PrdVersion" v ON v."prdId" = p.id AND v.version = p."currentVersion"
      WHERE ${whereClause}
      ORDER BY score DESC
    `;

    return {
      total: rows.length,
      hits: rows.map((row) => ({
        id: row.id,
        score: Number(row.score),
        title: row.title,
        content: "",
        projectId: row.projectId,
        authorId: row.authorId,
        status: row.status,
        tags: row.tags ?? [],
        version: row.version,
        highlight: row.highlight
          ? { content: [row.highlight] }
          : undefined,
      })),
    };
  }

  /**
   * Remove a PRD from the search index.
   *
   * No-op: the tsvector column lives on the Prd row itself,
   * so it is automatically deleted when the row is deleted.
   */
  async deletePrdIndex(_prdId: string): Promise<void> {
    // No-op - search vector is deleted with the row
  }
}
