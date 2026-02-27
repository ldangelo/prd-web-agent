/**
 * Git Service.
 *
 * Creates pull requests via the GitHub REST API. Each submission creates
 * a new branch and PR (supporting stacked PRs on re-submission).
 */

import type { GitPrResult } from "./types";

export interface CreatePrOptions {
  repo: string;
  branch: string;
  filePath: string;
  content: string;
  title: string;
  description: string;
  token: string;
  baseBranch?: string;
}

export class GitService {
  /**
   * Create a pull request by:
   * 1. Getting the SHA of the default branch
   * 2. Creating a new branch from that SHA
   * 3. Committing the file to the new branch
   * 4. Opening a pull request
   *
   * @param opts - PR creation options
   * @returns PR result with URL, number, and branch name
   */
  async createPr(opts: CreatePrOptions): Promise<GitPrResult> {
    const {
      repo,
      branch,
      filePath,
      content,
      title,
      description,
      token,
      baseBranch = "main",
    } = opts;

    const apiBase = `https://api.github.com/repos/${repo}`;
    const headers = this.buildHeaders(token);

    // 1. Get default branch SHA
    const refResponse = await fetch(
      `${apiBase}/git/ref/heads/${baseBranch}`,
      { method: "GET", headers },
    );

    if (!refResponse.ok) {
      const error = await refResponse.json();
      throw new Error(
        `GitHub API error (${refResponse.status}): ${JSON.stringify(error)}`,
      );
    }

    const refData = await refResponse.json();
    const baseSha = refData.object.sha;

    // 2. Create branch
    const branchResponse = await fetch(`${apiBase}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: baseSha,
      }),
    });

    if (!branchResponse.ok) {
      const error = await branchResponse.json();
      throw new Error(
        `GitHub API error (${branchResponse.status}): ${JSON.stringify(error)}`,
      );
    }

    // 3. Commit file
    const encodedContent = Buffer.from(content).toString("base64");

    const fileResponse = await fetch(`${apiBase}/contents/${filePath}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: title,
        content: encodedContent,
        branch,
      }),
    });

    if (!fileResponse.ok) {
      const error = await fileResponse.json();
      throw new Error(
        `GitHub API error (${fileResponse.status}): ${JSON.stringify(error)}`,
      );
    }

    // 4. Create pull request
    const prResponse = await fetch(`${apiBase}/pulls`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        body: description,
        head: branch,
        base: baseBranch,
      }),
    });

    if (!prResponse.ok) {
      const error = await prResponse.json();
      throw new Error(
        `GitHub API error (${prResponse.status}): ${JSON.stringify(error)}`,
      );
    }

    const prData = await prResponse.json();
    return {
      prUrl: prData.html_url,
      prNumber: prData.number,
      branch,
    };
  }

  private buildHeaders(token: string): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }
}
