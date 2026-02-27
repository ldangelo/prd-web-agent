/**
 * GitHub Submission Service tests.
 *
 * Tests for GitHub PR creation, branch management, file commits,
 * and re-submission (update existing PR) logic.
 *
 * Uses native fetch mocking — no external HTTP libraries.
 */

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import {
  GitHubSubmissionService,
  type GitHubSubmissionParams,
  type GitHubSubmissionResult,
} from "../github-submission-service";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const DEFAULT_PARAMS: GitHubSubmissionParams = {
  githubToken: "ghp_test_token_123",
  repoFullName: "acme-org/docs-repo",
  prdId: "prd_abc123",
  prdTitle: "My Awesome Feature PRD",
  prdContent: "# My Awesome Feature\n\nThis is the content.",
  labels: ["prd", "review-needed"],
  reviewers: ["reviewer1", "reviewer2"],
};

const DEFAULT_BRANCH_SHA = "abc123def456";
const CREATED_PR_URL = "https://github.com/acme-org/docs-repo/pull/42";
const CREATED_PR_NUMBER = 42;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mockGitHubApiSuccess(params: GitHubSubmissionParams) {
  const slug = slugify(params.prdTitle);
  const branch = `prd/${params.prdId}-${slug}`;

  mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
    const urlStr = url.toString();

    // GET default branch ref SHA
    if (urlStr.includes("/git/ref/heads/main") && (!options?.method || options.method === "GET")) {
      return {
        ok: true,
        json: async () => ({
          object: { sha: DEFAULT_BRANCH_SHA },
        }),
      };
    }

    // POST create branch ref
    if (urlStr.includes("/git/refs") && options?.method === "POST") {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          ref: `refs/heads/${branch}`,
          object: { sha: DEFAULT_BRANCH_SHA },
        }),
      };
    }

    // PUT create/update file contents
    if (urlStr.includes("/contents/") && options?.method === "PUT") {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          content: { sha: "file_sha_123" },
          commit: { sha: "commit_sha_456" },
        }),
      };
    }

    // GET check for existing PR (none found)
    if (urlStr.includes("/pulls?") && (!options?.method || options.method === "GET")) {
      return {
        ok: true,
        json: async () => [],
      };
    }

    // POST create PR
    if (urlStr.includes("/pulls") && options?.method === "POST") {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          html_url: CREATED_PR_URL,
          number: CREATED_PR_NUMBER,
        }),
      };
    }

    // POST add labels
    if (urlStr.includes("/labels") && options?.method === "POST") {
      return {
        ok: true,
        json: async () => [],
      };
    }

    // POST request reviewers
    if (urlStr.includes("/requested_reviewers") && options?.method === "POST") {
      return {
        ok: true,
        json: async () => ({}),
      };
    }

    return { ok: false, status: 404, json: async () => ({ message: "Not found" }) };
  });
}

function mockGitHubApiWithExistingPr(params: GitHubSubmissionParams) {
  const slug = slugify(params.prdTitle);
  const branch = `prd/${params.prdId}-${slug}`;

  mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
    const urlStr = url.toString();

    // GET default branch ref SHA
    if (urlStr.includes("/git/ref/heads/main") && (!options?.method || options.method === "GET")) {
      return {
        ok: true,
        json: async () => ({
          object: { sha: DEFAULT_BRANCH_SHA },
        }),
      };
    }

    // POST create branch ref — branch already exists (422)
    if (urlStr.includes("/git/refs") && options?.method === "POST") {
      return {
        ok: false,
        status: 422,
        json: async () => ({ message: "Reference already exists" }),
      };
    }

    // PUT create/update file contents (update existing)
    if (urlStr.includes("/contents/") && options?.method === "PUT") {
      return {
        ok: true,
        json: async () => ({
          content: { sha: "file_sha_updated" },
          commit: { sha: "commit_sha_updated" },
        }),
      };
    }

    // GET file contents to get existing file SHA
    if (urlStr.includes("/contents/") && (!options?.method || options.method === "GET")) {
      return {
        ok: true,
        json: async () => ({
          sha: "existing_file_sha",
        }),
      };
    }

    // GET check for existing PR (found one)
    if (urlStr.includes("/pulls?") && (!options?.method || options.method === "GET")) {
      return {
        ok: true,
        json: async () => [
          {
            html_url: "https://github.com/acme-org/docs-repo/pull/10",
            number: 10,
          },
        ],
      };
    }

    return { ok: false, status: 404, json: async () => ({ message: "Not found" }) };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GitHubSubmissionService", () => {
  let service: GitHubSubmissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GitHubSubmissionService();
  });

  // -----------------------------------------------------------------------
  // slugify helper
  // -----------------------------------------------------------------------

  describe("branch name generation", () => {
    it("should create a branch name from prdId and slugified title", async () => {
      mockGitHubApiSuccess(DEFAULT_PARAMS);

      const result = await service.submit(DEFAULT_PARAMS);

      expect(result.branch).toBe("prd/prd_abc123-my-awesome-feature-prd");
    });

    it("should handle special characters in the title", async () => {
      const params = { ...DEFAULT_PARAMS, prdTitle: "Feature: Add OAuth 2.0 & SSO!" };
      mockGitHubApiSuccess(params);

      const result = await service.submit(params);

      expect(result.branch).toBe("prd/prd_abc123-feature-add-oauth-2-0-sso");
    });
  });

  // -----------------------------------------------------------------------
  // First-time submission (new branch + new PR)
  // -----------------------------------------------------------------------

  describe("first-time submission", () => {
    beforeEach(() => {
      mockGitHubApiSuccess(DEFAULT_PARAMS);
    });

    it("should get the default branch SHA", async () => {
      await service.submit(DEFAULT_PARAMS);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/acme-org/docs-repo/git/ref/heads/main",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer ghp_test_token_123",
          }),
        }),
      );
    });

    it("should create a new branch from the default branch", async () => {
      await service.submit(DEFAULT_PARAMS);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/acme-org/docs-repo/git/refs",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("refs/heads/prd/prd_abc123-my-awesome-feature-prd"),
        }),
      );
    });

    it("should commit the PRD content as a file", async () => {
      await service.submit(DEFAULT_PARAMS);

      const putCall = mockFetch.mock.calls.find(
        ([url, opts]: [string, RequestInit]) =>
          url.includes("/contents/") && opts?.method === "PUT",
      );

      expect(putCall).toBeDefined();
      expect(putCall[0]).toContain(
        "docs/PRD/my-awesome-feature-prd-prd.md",
      );

      const body = JSON.parse(putCall[1].body as string);
      expect(body.branch).toBe("prd/prd_abc123-my-awesome-feature-prd");
      expect(body.message).toBeDefined();
      // Content should be base64-encoded
      expect(body.content).toBe(Buffer.from(DEFAULT_PARAMS.prdContent).toString("base64"));
    });

    it("should create a pull request", async () => {
      await service.submit(DEFAULT_PARAMS);

      const prCall = mockFetch.mock.calls.find(
        ([url, opts]: [string, RequestInit]) =>
          url.endsWith("/pulls") && opts?.method === "POST",
      );

      expect(prCall).toBeDefined();
      const body = JSON.parse(prCall[1].body as string);
      expect(body.head).toBe("prd/prd_abc123-my-awesome-feature-prd");
      expect(body.base).toBe("main");
      expect(body.title).toContain("My Awesome Feature PRD");
    });

    it("should add labels to the PR", async () => {
      await service.submit(DEFAULT_PARAMS);

      const labelCall = mockFetch.mock.calls.find(
        ([url, opts]: [string, RequestInit]) =>
          url.includes("/labels") && opts?.method === "POST",
      );

      expect(labelCall).toBeDefined();
      const body = JSON.parse(labelCall[1].body as string);
      expect(body.labels).toEqual(["prd", "review-needed"]);
    });

    it("should request reviewers for the PR", async () => {
      await service.submit(DEFAULT_PARAMS);

      const reviewerCall = mockFetch.mock.calls.find(
        ([url, opts]: [string, RequestInit]) =>
          url.includes("/requested_reviewers") && opts?.method === "POST",
      );

      expect(reviewerCall).toBeDefined();
      const body = JSON.parse(reviewerCall[1].body as string);
      expect(body.reviewers).toEqual(["reviewer1", "reviewer2"]);
    });

    it("should return the PR URL, number, and branch", async () => {
      const result = await service.submit(DEFAULT_PARAMS);

      expect(result).toEqual({
        prUrl: CREATED_PR_URL,
        prNumber: CREATED_PR_NUMBER,
        branch: "prd/prd_abc123-my-awesome-feature-prd",
      });
    });

    it("should skip labels when none provided", async () => {
      const params = { ...DEFAULT_PARAMS, labels: [] };
      mockGitHubApiSuccess(params);

      await service.submit(params);

      const labelCall = mockFetch.mock.calls.find(
        ([url, opts]: [string, RequestInit]) =>
          url.includes("/labels") && opts?.method === "POST",
      );

      expect(labelCall).toBeUndefined();
    });

    it("should skip reviewers when none provided", async () => {
      const params = { ...DEFAULT_PARAMS, reviewers: [] };
      mockGitHubApiSuccess(params);

      await service.submit(params);

      const reviewerCall = mockFetch.mock.calls.find(
        ([url, opts]: [string, RequestInit]) =>
          url.includes("/requested_reviewers") && opts?.method === "POST",
      );

      expect(reviewerCall).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Re-submission (existing branch + existing PR)
  // -----------------------------------------------------------------------

  describe("re-submission (update existing PR)", () => {
    beforeEach(() => {
      mockGitHubApiWithExistingPr(DEFAULT_PARAMS);
    });

    it("should handle branch already existing (422)", async () => {
      const result = await service.submit(DEFAULT_PARAMS);

      // Should not throw, should continue with existing branch
      expect(result.branch).toBe("prd/prd_abc123-my-awesome-feature-prd");
    });

    it("should update file content on existing branch", async () => {
      await service.submit(DEFAULT_PARAMS);

      const putCall = mockFetch.mock.calls.find(
        ([url, opts]: [string, RequestInit]) =>
          url.includes("/contents/") && opts?.method === "PUT",
      );

      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall[1].body as string);
      // Should include the existing file SHA for updates
      expect(body.sha).toBe("existing_file_sha");
    });

    it("should return existing PR info instead of creating new PR", async () => {
      const result = await service.submit(DEFAULT_PARAMS);

      expect(result.prUrl).toBe("https://github.com/acme-org/docs-repo/pull/10");
      expect(result.prNumber).toBe(10);
    });

    it("should not create a new PR when one already exists", async () => {
      await service.submit(DEFAULT_PARAMS);

      const createPrCall = mockFetch.mock.calls.find(
        ([url, opts]: [string, RequestInit]) =>
          url.endsWith("/pulls") && opts?.method === "POST",
      );

      expect(createPrCall).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  describe("error handling", () => {
    it("should throw when getting default branch SHA fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Not Found" }),
      });

      await expect(service.submit(DEFAULT_PARAMS)).rejects.toThrow(
        /Failed to get default branch/,
      );
    });

    it("should throw when branch creation fails with non-422 error", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
        callCount++;
        // First call: get default branch SHA - succeed
        if (callCount === 1) {
          return {
            ok: true,
            json: async () => ({ object: { sha: DEFAULT_BRANCH_SHA } }),
          };
        }
        // Second call: create branch - fail with 500
        return {
          ok: false,
          status: 500,
          json: async () => ({ message: "Internal Server Error" }),
        };
      });

      await expect(service.submit(DEFAULT_PARAMS)).rejects.toThrow(
        /Failed to create branch/,
      );
    });

    it("should throw when file commit fails", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
        const urlStr = url.toString();
        callCount++;

        if (urlStr.includes("/git/ref/heads/main")) {
          return { ok: true, json: async () => ({ object: { sha: DEFAULT_BRANCH_SHA } }) };
        }
        if (urlStr.includes("/git/refs") && options?.method === "POST") {
          return { ok: true, status: 201, json: async () => ({ ref: "refs/heads/test" }) };
        }
        if (urlStr.includes("/contents/") && options?.method === "PUT") {
          return { ok: false, status: 500, json: async () => ({ message: "Server Error" }) };
        }
        // GET for existing file SHA — return 404 (no existing file)
        if (urlStr.includes("/contents/") && (!options?.method || options.method === "GET")) {
          return { ok: false, status: 404, json: async () => ({ message: "Not Found" }) };
        }
        return { ok: true, json: async () => ({}) };
      });

      await expect(service.submit(DEFAULT_PARAMS)).rejects.toThrow(
        /Failed to commit PRD file/,
      );
    });

    it("should throw when PR creation fails", async () => {
      mockFetch.mockImplementation(async (url: string, options?: RequestInit) => {
        const urlStr = url.toString();

        if (urlStr.includes("/git/ref/heads/main")) {
          return { ok: true, json: async () => ({ object: { sha: DEFAULT_BRANCH_SHA } }) };
        }
        if (urlStr.includes("/git/refs") && options?.method === "POST") {
          return { ok: true, status: 201, json: async () => ({ ref: "refs/heads/test" }) };
        }
        if (urlStr.includes("/contents/") && options?.method === "PUT") {
          return { ok: true, status: 201, json: async () => ({ content: { sha: "s" }, commit: { sha: "c" } }) };
        }
        if (urlStr.includes("/contents/") && (!options?.method || options.method === "GET")) {
          return { ok: false, status: 404, json: async () => ({ message: "Not Found" }) };
        }
        if (urlStr.includes("/pulls?")) {
          return { ok: true, json: async () => [] };
        }
        if (urlStr.endsWith("/pulls") && options?.method === "POST") {
          return { ok: false, status: 422, json: async () => ({ message: "Validation Failed" }) };
        }
        return { ok: true, json: async () => ({}) };
      });

      await expect(service.submit(DEFAULT_PARAMS)).rejects.toThrow(
        /Failed to create pull request/,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Auth header
  // -----------------------------------------------------------------------

  describe("authentication", () => {
    it("should use Bearer token authentication for all API calls", async () => {
      mockGitHubApiSuccess(DEFAULT_PARAMS);

      await service.submit(DEFAULT_PARAMS);

      // Every fetch call should have the Authorization header
      for (const call of mockFetch.mock.calls) {
        const [, options] = call;
        expect(options?.headers?.Authorization).toBe("Bearer ghp_test_token_123");
      }
    });
  });
});
