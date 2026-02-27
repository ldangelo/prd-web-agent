/**
 * PostgreSQL full-text search setup.
 *
 * Adds the tsvector column and GIN index to the Prd table
 * if they do not already exist. Safe to call multiple times.
 */
import { prisma } from "@/lib/prisma";

/**
 * Ensure the search_vector column and GIN index exist on the Prd table.
 *
 * This is idempotent - uses IF NOT EXISTS / IF NOT EXISTS so it can
 * be called on every application startup without side effects.
 */
export async function ensureSearchIndex(): Promise<void> {
  await prisma.$executeRaw`
    ALTER TABLE "Prd" ADD COLUMN IF NOT EXISTS search_vector tsvector;
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS prd_search_idx ON "Prd" USING GIN(search_vector);
  `;
}
