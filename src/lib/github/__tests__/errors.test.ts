/**
 * GitHub-specific error classes tests (TDD: Red phase)
 *
 * TASK-069: Handle repo access revocation with specific error types
 */
import {
  GitHubApiError,
  GitHubTokenExpiredError,
  GitHubRepoAccessDeniedError,
  isGitHubAuthError,
} from "../errors";

describe("GitHubApiError", () => {
  it("should store message, status, and response body", () => {
    const error = new GitHubApiError("API failed", 500, {
      message: "Internal Server Error",
    });

    expect(error.message).toBe("API failed");
    expect(error.statusCode).toBe(500);
    expect(error.responseBody).toEqual({ message: "Internal Server Error" });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error.name).toBe("GitHubApiError");
  });

  it("should have undefined responseBody when not provided", () => {
    const error = new GitHubApiError("API failed", 500);

    expect(error.responseBody).toBeUndefined();
  });

  it("should have a needsReauth property that is false by default", () => {
    const error = new GitHubApiError("API failed", 500);

    expect(error.needsReauth).toBe(false);
  });
});

describe("GitHubTokenExpiredError", () => {
  it("should have 401 status and needsReauth true", () => {
    const error = new GitHubTokenExpiredError();

    expect(error.statusCode).toBe(401);
    expect(error.needsReauth).toBe(true);
    expect(error.name).toBe("GitHubTokenExpiredError");
    expect(error.message).toBe(
      "GitHub token has expired. Please re-authenticate.",
    );
    expect(error).toBeInstanceOf(GitHubApiError);
  });

  it("should accept a custom message", () => {
    const error = new GitHubTokenExpiredError("Custom token expired message");

    expect(error.message).toBe("Custom token expired message");
    expect(error.needsReauth).toBe(true);
  });
});

describe("GitHubRepoAccessDeniedError", () => {
  it("should have 403 status and needsReauth true", () => {
    const error = new GitHubRepoAccessDeniedError("org/repo");

    expect(error.statusCode).toBe(403);
    expect(error.needsReauth).toBe(true);
    expect(error.repoFullName).toBe("org/repo");
    expect(error.name).toBe("GitHubRepoAccessDeniedError");
    expect(error.message).toBe(
      "Access to repository org/repo has been revoked. Please re-authorize.",
    );
    expect(error).toBeInstanceOf(GitHubApiError);
  });

  it("should handle 404 status for repos that user cannot see", () => {
    const error = new GitHubRepoAccessDeniedError("org/private-repo", 404);

    expect(error.statusCode).toBe(404);
    expect(error.needsReauth).toBe(true);
    expect(error.repoFullName).toBe("org/private-repo");
  });
});

describe("isGitHubAuthError", () => {
  it("should return true for GitHubTokenExpiredError", () => {
    expect(isGitHubAuthError(new GitHubTokenExpiredError())).toBe(true);
  });

  it("should return true for GitHubRepoAccessDeniedError", () => {
    expect(
      isGitHubAuthError(new GitHubRepoAccessDeniedError("org/repo")),
    ).toBe(true);
  });

  it("should return false for generic GitHubApiError", () => {
    expect(isGitHubAuthError(new GitHubApiError("fail", 500))).toBe(false);
  });

  it("should return false for plain Error", () => {
    expect(isGitHubAuthError(new Error("fail"))).toBe(false);
  });

  it("should return false for non-errors", () => {
    expect(isGitHubAuthError("string")).toBe(false);
    expect(isGitHubAuthError(null)).toBe(false);
  });
});
