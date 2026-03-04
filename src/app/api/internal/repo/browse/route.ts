/**
 * GET /api/internal/repo/browse
 *
 * Internal endpoint for OpenClaw to browse a cloned repository's directory
 * contents. Returns a single-level directory listing (non-recursive).
 *
 * Query params:
 *   - projectId (required)
 *   - userId    (required)
 *   - path      (optional, defaults to repo root "")
 *
 * Authenticated via OPENCLAW_INTERNAL_TOKEN.
 */
import * as fs from "fs/promises";
import * as nodePath from "path";
import { type NextRequest } from "next/server";
import { validateInternalToken } from "../../auth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { RepoCloneService } from "@/services/repo-clone-service";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/** Directory names that are always excluded from the listing. */
const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
]);

const repoCloneService = new RepoCloneService();

export interface BrowseEntry {
  name: string;
  type: "file" | "dir";
  path: string;
}

export interface BrowseResponseData {
  entries: BrowseEntry[];
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authError = validateInternalToken(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const userId = searchParams.get("userId");
    const relativePath = searchParams.get("path") ?? "";

    if (!projectId || !userId) {
      return apiError("Missing required query params: projectId, userId", 400);
    }

    const cloneDir = repoCloneService.getCloneDir(userId, projectId);

    // Verify the clone exists
    try {
      await fs.access(cloneDir);
    } catch {
      // Clone directory doesn't exist — attempt on-demand clone
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { githubRepo: true },
      });
      if (!project?.githubRepo) {
        return apiError("Repository not found or has no GitHub repo configured", 404);
      }
      const account = await prisma.account.findFirst({
        where: { userId, provider: "github" },
        select: { access_token: true },
      });
      if (!account?.access_token) {
        return apiError("No GitHub OAuth token found for user", 401);
      }
      try {
        await repoCloneService.cloneRepo(userId, projectId, project.githubRepo, account.access_token);
        logger.info({ userId, projectId }, "Repo cloned on-demand for browse");
      } catch (cloneErr) {
        logger.error({ err: cloneErr, userId, projectId }, "On-demand repo clone failed");
        return apiError("Failed to clone repository", 502);
      }
    }

    // Resolve and validate the target path to prevent directory traversal
    const targetPath = nodePath.resolve(cloneDir, relativePath);
    if (!targetPath.startsWith(cloneDir + nodePath.sep) && targetPath !== cloneDir) {
      logger.warn(
        { userId, projectId, relativePath },
        "Repo browse path traversal attempt blocked",
      );
      return apiError("Invalid path: must remain within the repository root", 400);
    }

    // Read directory entries (depth 1 only)
    let dirents: fs.Dirent[];
    try {
      dirents = await fs.readdir(targetPath, { withFileTypes: true });
    } catch {
      return apiError("Path not found or not a directory", 404);
    }

    const entries: BrowseEntry[] = [];

    for (const dirent of dirents) {
      const isDir = dirent.isDirectory();

      // Exclude unwanted directories
      if (isDir && EXCLUDED_DIRS.has(dirent.name)) {
        continue;
      }

      // Build a repo-relative path for the entry using forward slashes
      const entryRelativePath = relativePath
        ? `${relativePath}/${dirent.name}`.replace(/\\/g, "/")
        : dirent.name;

      entries.push({
        name: dirent.name,
        type: isDir ? "dir" : "file",
        path: entryRelativePath,
      });
    }

    // Sort: dirs first, then files, each group alphabetically
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    logger.info(
      { userId, projectId, relativePath, entryCount: entries.length },
      "Repo directory listed",
    );

    return apiSuccess<BrowseResponseData>({ entries });
  } catch (error) {
    logger.error({ error }, "Error in internal repo browse");
    return handleApiError(error);
  }
}
