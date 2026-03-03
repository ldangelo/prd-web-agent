-- AlterTable
ALTER TABLE "Prd" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Prd" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Index: partial index on non-deleted PRDs for efficient filtered queries
CREATE INDEX IF NOT EXISTS "Prd_isDeleted_idx" ON "Prd" ("isDeleted") WHERE "isDeleted" = false;
