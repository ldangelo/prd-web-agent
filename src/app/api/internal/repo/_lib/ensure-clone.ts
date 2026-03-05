/**
 * Shared helper: ensure a repository clone exists for the given user/project.
 *
 * Returns `{ cloneDir }` when the clone is available (existing or freshly
 * cloned), or a `NextResponse` error that the caller should return directly.
 */
import * as fsp from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RepoCloneService } from "@/services/repo-clone-service";
import logger from "@/lib/logger";

const repoCloneService = new RepoCloneService();

export async function ensureRepoClone(
  userId: string,
  projectId: string,
): Promise<{ cloneDir: string } | NextResponse> {
  const cloneDir = repoCloneService.getCloneDir(userId, projectId);

  // Check if a valid git clone already exists on disk
  try {
    await fsp.access(`${cloneDir}/.git`);
    return { cloneDir };
  } catch {
    // Not cloned yet (or previous clone failed and left an empty dir) — attempt on-demand clone
  }

  // Look up project for githubRepo
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { githubRepo: true },
  });
  if (!project?.githubRepo) {
    return NextResponse.json(
      { error: "No GitHub repository configured for this project" },
      { status: 404 },
    );
  }

  // Look up OAuth token for this user
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" },
    select: { access_token: true },
  });
  if (!account?.access_token) {
    return NextResponse.json(
      { error: "No GitHub OAuth token available" },
      { status: 401 },
    );
  }

  try {
    await repoCloneService.cloneRepo(
      userId,
      projectId,
      project.githubRepo,
      account.access_token,
    );
    return { cloneDir };
  } catch (err) {
    logger.error({ err, userId, projectId }, "On-demand repo clone failed");
    return NextResponse.json(
      { error: "Failed to clone repository" },
      { status: 502 },
    );
  }
}
