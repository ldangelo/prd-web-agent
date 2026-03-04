import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import logger from "@/lib/logger";

/**
 * Manages git repository clones on EFS for agent context.
 *
 * TASK-068: Updated for per-user clones using OAuth token.
 *
 * - Per-user clone paths: /efs/repos/<user-id>/<project-id>/
 * - Uses the user's GitHub OAuth token (passed as parameter)
 * - Token injected into clone URL for HTTPS authentication
 * - Surfaces clear errors on authentication failures (401)
 * - Periodic git pull every 15 minutes
 * - On-demand sync before agent sessions
 * - Cleanup on project deletion
 * - Non-fatal sync failures (logs warning, continues with stale data)
 */
export class RepoCloneService {
  private syncTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  private readonly efsReposDir: string;

  constructor(efsReposDir?: string) {
    this.efsReposDir =
      efsReposDir ?? process.env.EFS_REPOS_DIR ?? "/efs/repos";
  }

  /**
   * Get the local clone directory for a user's project.
   * Path: /efs/repos/<userId>/<projectId>/
   */
  getCloneDir(userId: string, projectId: string): string {
    return path.join(this.efsReposDir, userId, projectId);
  }

  /**
   * Clone a git repository for a user's project.
   *
   * @param userId - The user who owns this clone
   * @param projectId - The project ID
   * @param githubRepo - The GitHub repo HTTPS URL (e.g., https://github.com/org/repo.git)
   * @param oauthToken - The user's GitHub OAuth access token
   */
  async cloneRepo(
    userId: string,
    projectId: string,
    githubRepo: string,
    oauthToken: string,
  ): Promise<void> {
    const cloneDir = this.getCloneDir(userId, projectId);

    try {
      await fs.access(cloneDir);
      // Directory exists, just sync instead
      await this.pullRepo(cloneDir);
      return;
    } catch {
      // Directory doesn't exist, proceed with clone
    }

    await fs.mkdir(cloneDir, { recursive: true });

    // Inject token into the URL for HTTPS clones
    const authedUrl = githubRepo.replace(
      "https://",
      `https://x-access-token:${oauthToken}@`,
    );

    try {
      await this.execFileAsync("git", ["clone", authedUrl, cloneDir], {
        timeout: 120_000,
      });
    } catch (error: any) {
      // Redact token from any error messages before propagating
      const message = (error?.message ?? "").replace(
        /x-access-token:[^@]+@/g,
        "x-access-token:[REDACTED]@",
      );
      if (
        message.includes("Authentication failed") ||
        message.includes("could not read Username") ||
        message.includes("terminal prompts disabled") ||
        message.includes("401")
      ) {
        throw new Error(
          `Authentication failed for repository clone. The GitHub token may be expired or revoked.`,
        );
      }
      // Re-throw with sanitised message
      const sanitised = new Error(message);
      sanitised.stack = error.stack?.replace(
        /x-access-token:[^@]+@/g,
        "x-access-token:[REDACTED]@",
      );
      throw sanitised;
    }

    this.startPeriodicSync(userId, projectId, cloneDir);
  }

  /**
   * Ensure the clone is synced (pull latest). Non-fatal on failure.
   */
  async ensureSynced(
    userId: string,
    projectId: string,
    cloneDir: string,
  ): Promise<void> {
    const timerKey = this.timerKey(userId, projectId);

    try {
      await this.pullRepo(cloneDir);
    } catch (error: any) {
      // Non-fatal: log warning but continue with stale data
      logger.warn(
        { userId, projectId, error },
        "RepoCloneService: sync failed",
      );
    }

    // Ensure periodic sync is running
    if (!this.syncTimers.has(timerKey)) {
      this.startPeriodicSync(userId, projectId, cloneDir);
    }
  }

  /**
   * Remove the clone directory and stop syncing.
   */
  async removeClone(userId: string, projectId: string): Promise<void> {
    const timerKey = this.timerKey(userId, projectId);
    this.stopPeriodicSync(timerKey);

    const cloneDir = this.getCloneDir(userId, projectId);
    try {
      await fs.rm(cloneDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Dispose all timers. Call on process shutdown.
   */
  async disposeAll(): Promise<void> {
    for (const [key] of this.syncTimers) {
      this.stopPeriodicSync(key);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private timerKey(userId: string, projectId: string): string {
    return `${userId}:${projectId}`;
  }

  private startPeriodicSync(
    userId: string,
    projectId: string,
    cloneDir: string,
  ): void {
    const key = this.timerKey(userId, projectId);
    this.stopPeriodicSync(key); // clear any existing timer

    const timer = setInterval(async () => {
      try {
        await this.pullRepo(cloneDir);
      } catch (error: any) {
        logger.warn(
          { userId, projectId, error },
          "RepoCloneService: periodic sync failed",
        );
      }
    }, this.SYNC_INTERVAL_MS);

    this.syncTimers.set(key, timer);
  }

  private stopPeriodicSync(key: string): void {
    const timer = this.syncTimers.get(key);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(key);
    }
  }

  private pullRepo(cloneDir: string): Promise<string> {
    return this.execFileAsync("git", ["pull", "--ff-only"], { cwd: cloneDir });
  }

  private execFileAsync(
    file: string,
    args: string[],
    options: Record<string, any> = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(file, args, options, (error, stdout, _stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout as string);
        }
      });
    });
  }
}
