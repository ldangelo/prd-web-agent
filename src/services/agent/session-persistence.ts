/**
 * Session persistence helpers for EFS-backed session storage.
 *
 * Each user gets a directory under the EFS mount point where agent session
 * files are persisted so they can be resumed across server restarts or
 * container replacements.
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Root directory for session storage. In production this should point to an
 * EFS-mounted path. Falls back to a local tmp directory for development.
 */
export function getEfsBaseDir(): string {
  return process.env.EFS_SESSION_DIR || "/tmp/prd-agent-sessions";
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SessionInfo {
  sessionId: string;
  filePath: string;
  createdAt: Date;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the directory path where a given user's sessions are stored.
 * Creates the directory if it does not yet exist.
 */
export function getSessionDir(userId: string): string {
  const dir = path.join(getEfsBaseDir(), userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * List all persisted session files for a user.
 * Returns an array of SessionInfo sorted by creation time (newest first).
 */
export async function listUserSessions(
  userId: string,
): Promise<SessionInfo[]> {
  const dir = getSessionDir(userId);

  let entries: string[];
  try {
    entries = await fs.promises.readdir(dir);
  } catch {
    return [];
  }

  const sessions: SessionInfo[] = [];

  for (const entry of entries) {
    // Only consider .json session files
    if (!entry.endsWith(".json")) continue;

    const filePath = path.join(dir, entry);
    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) continue;

      sessions.push({
        sessionId: path.basename(entry, ".json"),
        filePath,
        createdAt: stat.birthtime,
        sizeBytes: stat.size,
      });
    } catch {
      // Skip files we cannot stat (e.g. removed between readdir and stat)
      continue;
    }
  }

  // Newest first
  sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return sessions;
}

/**
 * Find the file path for a specific session belonging to a user.
 * Returns null if the session file does not exist.
 */
export async function findSessionFile(
  sessionId: string,
  userId: string,
): Promise<string | null> {
  const dir = getSessionDir(userId);
  const filePath = path.join(dir, `${sessionId}.json`);

  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    return filePath;
  } catch {
    return null;
  }
}
