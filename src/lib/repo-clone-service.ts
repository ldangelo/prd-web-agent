/**
 * Shared RepoCloneService singleton.
 *
 * All application code should import `repoCloneService` from here rather than
 * instantiating `new RepoCloneService()` directly. A single shared instance
 * ensures that periodic sync timers registered by one callsite (e.g. when a
 * clone is created) are visible to other callsites (e.g. when a clone is
 * removed), so `stopPeriodicSync` reliably cancels the timer on cleanup.
 */
import { RepoCloneService } from "@/services/repo-clone-service";

export const repoCloneService = new RepoCloneService();
