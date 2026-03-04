/**
 * GET /api/internal/repo/file
 *
 * Internal endpoint for OpenClaw to read the contents of a single file
 * from a cloned repository.
 *
 * Query params:
 *   - projectId (required)
 *   - userId    (required)
 *   - path      (required)  — repo-relative path to the file
 *
 * Limits:
 *   - Files larger than 100 KB are rejected.
 *   - Paths that escape the repository root are rejected (traversal protection).
 *
 * Authenticated via OPENCLAW_INTERNAL_TOKEN.
 */
import * as fs from "fs/promises";
import * as nodePath from "path";
import { type NextRequest, NextResponse } from "next/server";
import { validateInternalToken } from "../../auth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import logger from "@/lib/logger";
import { ensureRepoClone } from "../_lib/ensure-clone";

const MAX_FILE_SIZE_BYTES = 100 * 1024; // 100 KB

export interface FileResponseData {
  content: string;
  path: string;
  size: number;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authError = validateInternalToken(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const userId = searchParams.get("userId");
    const relativePath = searchParams.get("path");

    if (!projectId || !userId) {
      return apiError("Missing required query params: projectId, userId", 400);
    }

    if (!relativePath) {
      return apiError("Missing required query param: path", 400);
    }

    // Ensure the clone exists (on-demand clone if needed)
    const result = await ensureRepoClone(userId, projectId);
    if (result instanceof NextResponse) {
      return result;
    }
    const { cloneDir } = result;

    // Resolve the absolute file path and guard against directory traversal.
    // nodePath.resolve handles ".." components, so we can check the result.
    const absoluteFilePath = nodePath.resolve(cloneDir, relativePath);

    // The resolved path must start with cloneDir followed by the OS separator
    // (or be equal to cloneDir itself, though reading a directory is rejected below).
    if (
      !absoluteFilePath.startsWith(cloneDir + nodePath.sep) &&
      absoluteFilePath !== cloneDir
    ) {
      logger.warn(
        { userId, projectId, relativePath },
        "Repo file read path traversal attempt blocked",
      );
      return apiError(
        "Invalid path: must remain within the repository root",
        400,
      );
    }

    // Stat the file to check size and confirm it is a regular file
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(absoluteFilePath);
    } catch {
      return apiError("File not found", 404);
    }

    // Reject directories
    if (stat.isDirectory()) {
      return apiError("Path is a directory, not a file", 400);
    }

    const size = stat.size;

    if (size > MAX_FILE_SIZE_BYTES) {
      logger.info(
        { userId, projectId, relativePath, size },
        "Repo file read rejected: file too large",
      );
      return apiError("File too large", 413);
    }

    const content = await fs.readFile(absoluteFilePath, "utf-8");

    logger.info(
      { userId, projectId, relativePath, size },
      "Repo file read",
    );

    return apiSuccess<FileResponseData>({
      content,
      path: relativePath,
      size,
    });
  } catch (error) {
    logger.error({ error }, "Error in internal repo file read");
    return handleApiError(error);
  }
}
