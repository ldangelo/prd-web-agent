-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('MEMBER', 'REVIEWER', 'SUBMITTER', 'APPROVER', 'ADMIN');

-- Add new role column with default MEMBER
ALTER TABLE "ProjectMember" ADD COLUMN "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER';

-- Migrate existing isReviewer data
UPDATE "ProjectMember" SET "role" = 'REVIEWER' WHERE "isReviewer" = true;

-- Drop old column
ALTER TABLE "ProjectMember" DROP COLUMN "isReviewer";
