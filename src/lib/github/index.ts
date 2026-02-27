/**
 * GitHub integration utilities.
 *
 * Re-exports error classes and token service for convenient imports.
 */
export {
  GitHubApiError,
  GitHubTokenExpiredError,
  GitHubRepoAccessDeniedError,
  isGitHubAuthError,
  classifyGitHubError,
} from "./errors";

export { GitHubTokenService } from "./token-service";
