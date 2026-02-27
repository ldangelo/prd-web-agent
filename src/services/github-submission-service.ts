/**
 * GitHub Submission Service.
 *
 * Handles the actual GitHub API calls for PRD submission:
 * - Creates a branch from the default branch
 * - Commits the PRD markdown content as a file
 * - Opens a pull request (or updates an existing one on re-submission)
 * - Adds labels and requests reviewers
 *
 * Uses native fetch with the user's OAuth token (no external libraries).
 */

export interface GitHubSubmissionParams {
  /** User's GitHub OAuth access token */
  githubToken: string;
  /** Full repo name, e.g. "acme-org/docs-repo" */
  repoFullName: string;
  /** PRD ID used in the branch name */
  prdId: string;
  /** PRD title used for branch slug and PR title */
  prdTitle: string;
  /** PRD markdown content to commit */
  prdContent: string;
  /** Labels to apply to the PR */
  labels: string[];
  /** GitHub usernames to request as reviewers */
  reviewers: string[];
}

export interface GitHubSubmissionResult {
  /** URL of the created/existing PR */
  prUrl: string;
  /** PR number */
  prNumber: number;
  /** Branch name created/used */
  branch: string;
}

/**
 * Slugify a string for use in branch names and file paths.
 * Converts to lowercase, replaces non-alphanumeric chars with hyphens,
 * and trims leading/trailing hyphens.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const GITHUB_API_BASE = "https://api.github.com";
const DEFAULT_BRANCH = "main";

export class GitHubSubmissionService {
  /**
   * Submit a PRD to GitHub by creating a branch, committing the file,
   * and opening (or updating) a pull request.
   */
  async submit(params: GitHubSubmissionParams): Promise<GitHubSubmissionResult> {
    const { githubToken, repoFullName, prdId, prdTitle, prdContent, labels, reviewers } = params;

    const slug = slugify(prdTitle);
    const branch = `prd/${prdId}-${slug}`;
    const filePath = `docs/PRD/${slug}-prd.md`;
    const headers = this.buildHeaders(githubToken);

    // 1. Get the default branch SHA
    const defaultBranchSha = await this.getDefaultBranchSha(repoFullName, headers);

    // 2. Create the branch (or skip if it already exists)
    await this.createBranch(repoFullName, branch, defaultBranchSha, headers);

    // 3. Get existing file SHA if updating
    const existingFileSha = await this.getExistingFileSha(repoFullName, filePath, branch, headers);

    // 4. Commit the PRD file
    await this.commitFile(repoFullName, filePath, prdContent, branch, existingFileSha, headers);

    // 5. Check for existing PR
    const existingPr = await this.findExistingPr(repoFullName, branch, headers);

    if (existingPr) {
      // Re-submission: return existing PR info (new commit was already pushed)
      return {
        prUrl: existingPr.html_url,
        prNumber: existingPr.number,
        branch,
      };
    }

    // 6. Create a new PR
    const pr = await this.createPr(repoFullName, branch, prdTitle, headers);

    // 7. Add labels (if any)
    if (labels.length > 0) {
      await this.addLabels(repoFullName, pr.number, labels, headers);
    }

    // 8. Request reviewers (if any)
    if (reviewers.length > 0) {
      await this.requestReviewers(repoFullName, pr.number, reviewers, headers);
    }

    return {
      prUrl: pr.html_url,
      prNumber: pr.number,
      branch,
    };
  }

  private buildHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };
  }

  private async getDefaultBranchSha(
    repoFullName: string,
    headers: Record<string, string>,
  ): Promise<string> {
    const url = `${GITHUB_API_BASE}/repos/${repoFullName}/git/ref/heads/${DEFAULT_BRANCH}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new Error(`Failed to get default branch SHA: ${(await res.json()).message}`);
    }

    const data = await res.json();
    return data.object.sha;
  }

  private async createBranch(
    repoFullName: string,
    branch: string,
    sha: string,
    headers: Record<string, string>,
  ): Promise<void> {
    const url = `${GITHUB_API_BASE}/repos/${repoFullName}/git/refs`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      // 422 means the branch already exists — that's fine for re-submission
      if (res.status === 422) {
        return;
      }
      throw new Error(`Failed to create branch: ${errorData.message}`);
    }
  }

  private async getExistingFileSha(
    repoFullName: string,
    filePath: string,
    branch: string,
    headers: Record<string, string>,
  ): Promise<string | null> {
    const url = `${GITHUB_API_BASE}/repos/${repoFullName}/contents/${filePath}?ref=${branch}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      return null; // File doesn't exist yet
    }

    const data = await res.json();
    return data.sha;
  }

  private async commitFile(
    repoFullName: string,
    filePath: string,
    content: string,
    branch: string,
    existingSha: string | null,
    headers: Record<string, string>,
  ): Promise<void> {
    const url = `${GITHUB_API_BASE}/repos/${repoFullName}/contents/${filePath}`;
    const body: Record<string, string> = {
      message: existingSha ? `Update PRD: ${filePath}` : `Add PRD: ${filePath}`,
      content: Buffer.from(content).toString("base64"),
      branch,
    };

    if (existingSha) {
      body.sha = existingSha;
    }

    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Failed to commit PRD file: ${(await res.json()).message}`);
    }
  }

  private async findExistingPr(
    repoFullName: string,
    branch: string,
    headers: Record<string, string>,
  ): Promise<{ html_url: string; number: number } | null> {
    const [owner] = repoFullName.split("/");
    const url = `${GITHUB_API_BASE}/repos/${repoFullName}/pulls?head=${owner}:${branch}&state=open`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      return null;
    }

    const prs = await res.json();
    if (prs.length > 0) {
      return { html_url: prs[0].html_url, number: prs[0].number };
    }

    return null;
  }

  private async createPr(
    repoFullName: string,
    branch: string,
    title: string,
    headers: Record<string, string>,
  ): Promise<{ html_url: string; number: number }> {
    const url = `${GITHUB_API_BASE}/repos/${repoFullName}/pulls`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: `PRD: ${title}`,
        head: branch,
        base: DEFAULT_BRANCH,
        body: `This pull request adds/updates the PRD: **${title}**.\n\nAutomatically submitted via PRD Web Agent.`,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create pull request: ${(await res.json()).message}`);
    }

    const data = await res.json();
    return { html_url: data.html_url, number: data.number };
  }

  private async addLabels(
    repoFullName: string,
    prNumber: number,
    labels: string[],
    headers: Record<string, string>,
  ): Promise<void> {
    const url = `${GITHUB_API_BASE}/repos/${repoFullName}/issues/${prNumber}/labels`;
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ labels }),
    });
  }

  private async requestReviewers(
    repoFullName: string,
    prNumber: number,
    reviewers: string[],
    headers: Record<string, string>,
  ): Promise<void> {
    const url = `${GITHUB_API_BASE}/repos/${repoFullName}/pulls/${prNumber}/requested_reviewers`;
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ reviewers }),
    });
  }
}
