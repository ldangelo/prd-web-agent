/**
 * Shared singleton instance of RepoCloneService.
 *
 * Import this singleton instead of constructing a new RepoCloneService()
 * so that all callers share the same EFS state and periodic-sync timers.
 */
import { RepoCloneService } from "@/services/repo-clone-service";

export const repoCloneService = new RepoCloneService();
