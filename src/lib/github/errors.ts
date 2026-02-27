/**
 * GitHub-specific error classes for handling API failures,
 * token expiration, and repo access revocation.
 *
 * TASK-069: Handle repo access revocation
 * TASK-070: Handle OAuth token expiration
 */

/**
 * Base error class for GitHub API failures.
 */
export class GitHubApiError extends Error {
  public readonly statusCode: number;
  public readonly responseBody?: unknown;
  public readonly needsReauth: boolean;

  constructor(
    message: string,
    statusCode: number,
    responseBody?: unknown,
    needsReauth: boolean = false,
  ) {
    super(message);
    this.name = "GitHubApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.needsReauth = needsReauth;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert to a frontend-friendly error response object.
   */
  toErrorResponse(): {
    error: string;
    message: string;
    action?: string;
    needsReauth: boolean;
  } {
    return {
      error: this.name,
      message: this.message,
      needsReauth: this.needsReauth,
      ...(this.needsReauth ? { action: "reauthenticate" } : {}),
    };
  }
}

/**
 * Thrown when a GitHub OAuth token has expired or is invalid.
 * GitHub returns 401 with "Bad credentials" message.
 */
export class GitHubTokenExpiredError extends GitHubApiError {
  constructor(
    message: string = "GitHub token has expired. Please re-authenticate.",
  ) {
    super(message, 401, undefined, true);
    this.name = "GitHubTokenExpiredError";
  }
}

/**
 * Thrown when access to a specific repository has been revoked.
 * GitHub returns 403 (forbidden) or 404 (not found / private).
 */
export class GitHubRepoAccessDeniedError extends GitHubApiError {
  public readonly repoFullName: string;

  constructor(repoFullName: string, statusCode: number = 403) {
    super(
      `Access to repository ${repoFullName} has been revoked. Please re-authorize.`,
      statusCode,
      undefined,
      true,
    );
    this.name = "GitHubRepoAccessDeniedError";
    this.repoFullName = repoFullName;
  }
}

/**
 * Type guard: returns true if the error is a GitHub auth-related error
 * that requires user re-authentication.
 */
export function isGitHubAuthError(error: unknown): boolean {
  if (error instanceof GitHubApiError) {
    return error.needsReauth;
  }
  return false;
}

/**
 * Classify a GitHub API HTTP response into the appropriate error.
 *
 * @param status - HTTP status code from GitHub
 * @param body - Parsed JSON body from the response (optional)
 * @param repoFullName - The repo full name for access-denied errors (optional)
 */
export function classifyGitHubError(
  status: number,
  body?: { message?: string },
  repoFullName?: string,
): GitHubApiError {
  if (status === 401) {
    return new GitHubTokenExpiredError();
  }

  if ((status === 403 || status === 404) && repoFullName) {
    return new GitHubRepoAccessDeniedError(repoFullName, status);
  }

  return new GitHubApiError(
    body?.message ?? `GitHub API error (HTTP ${status})`,
    status,
    body,
  );
}
