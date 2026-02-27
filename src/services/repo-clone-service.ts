import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Manages git repository clones on EFS for agent context.
 *
 * - Clones repos on project creation
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
   * Get the local clone directory for a project.
   */
  getCloneDir(projectId: string): string {
    return path.join(this.efsReposDir, projectId);
  }

  /**
   * Clone a git repository for a project.
   */
  async cloneRepo(
    projectId: string,
    gitRepo: string,
    gitToken: string,
  ): Promise<void> {
    const cloneDir = this.getCloneDir(projectId);

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
    const authedUrl = gitRepo.replace(
      "https://",
      `https://x-access-token:${gitToken}@`,
    );

    await this.execAsync(`git clone ${authedUrl} ${cloneDir}`, {
      timeout: 120_000,
    });

    this.startPeriodicSync(projectId, cloneDir);
  }

  /**
   * Ensure the clone is synced (pull latest). Non-fatal on failure.
   */
  async ensureSynced(projectId: string, cloneDir: string): Promise<void> {
    try {
      await this.pullRepo(cloneDir);
    } catch (error: any) {
      // Non-fatal: log warning but continue with stale data
      console.warn(
        `[RepoCloneService] Sync failed for project ${projectId}: ${error.message}`,
      );
    }

    // Ensure periodic sync is running
    if (!this.syncTimers.has(projectId)) {
      this.startPeriodicSync(projectId, cloneDir);
    }
  }

  /**
   * Remove the clone directory and stop syncing.
   */
  async removeClone(projectId: string): Promise<void> {
    this.stopPeriodicSync(projectId);

    const cloneDir = this.getCloneDir(projectId);
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
    for (const [projectId] of this.syncTimers) {
      this.stopPeriodicSync(projectId);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private startPeriodicSync(projectId: string, cloneDir: string): void {
    this.stopPeriodicSync(projectId); // clear any existing timer

    const timer = setInterval(async () => {
      try {
        await this.pullRepo(cloneDir);
      } catch (error: any) {
        console.warn(
          `[RepoCloneService] Periodic sync failed for project ${projectId}: ${error.message}`,
        );
      }
    }, this.SYNC_INTERVAL_MS);

    this.syncTimers.set(projectId, timer);
  }

  private stopPeriodicSync(projectId: string): void {
    const timer = this.syncTimers.get(projectId);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(projectId);
    }
  }

  private pullRepo(cloneDir: string): Promise<string> {
    return this.execAsync("git pull --ff-only", { cwd: cloneDir });
  }

  private execAsync(
    command: string,
    options: Record<string, any> = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, options, (error, stdout, _stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout as string);
        }
      });
    });
  }
}
