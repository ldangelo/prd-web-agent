/**
 * GitHub OAuth token management service.
 *
 * TASK-070: Handle OAuth token expiration
 *
 * - Retrieves tokens from the Account table
 * - Validates tokens against GitHub API
 * - Attempts token refresh when refresh_token is available
 * - Throws GitHubTokenExpiredError when re-authentication is required
 */
import { prisma } from "@/lib/prisma";
import { GitHubTokenExpiredError } from "./errors";

const GITHUB_OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token";

interface AccountTokenData {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at?: number | null;
}

interface GitHubRefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export class GitHubTokenService {
  /**
   * Get the GitHub access token for a user from the Account table.
   *
   * @returns The access_token string, or null if not found.
   */
  async getGitHubToken(userId: string): Promise<string | null> {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "github" },
      select: {
        id: true,
        access_token: true,
        refresh_token: true,
        expires_at: true,
      },
    });

    if (!account || !account.access_token) {
      return null;
    }

    return account.access_token;
  }

  /**
   * Attempt to refresh the GitHub token using the stored refresh_token.
   *
   * @returns The new access_token, or null if refresh is not possible.
   */
  async refreshGitHubToken(userId: string): Promise<string | null> {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "github" },
      select: {
        id: true,
        access_token: true,
        refresh_token: true,
        expires_at: true,
      },
    });

    if (!account || !account.refresh_token) {
      return null;
    }

    try {
      const response = await fetch(GITHUB_OAUTH_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: account.refresh_token,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data: GitHubRefreshResponse = await response.json();

      // Update the account with new tokens
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: data.access_token,
          refresh_token: data.refresh_token ?? account.refresh_token,
          ...(data.expires_in
            ? {
                expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
              }
            : {}),
        },
      });

      return data.access_token;
    } catch {
      return null;
    }
  }

  /**
   * Validate a GitHub token by calling the GitHub API.
   *
   * @returns true if the token is valid, false otherwise.
   */
  async validateGitHubToken(token: string): Promise<boolean> {
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get a valid token for the user, attempting refresh if needed.
   *
   * @throws GitHubTokenExpiredError if no valid token can be obtained.
   */
  async getValidTokenOrRefresh(userId: string): Promise<string> {
    const token = await this.getGitHubToken(userId);

    if (!token) {
      throw new GitHubTokenExpiredError(
        "No GitHub token found. Please re-authenticate with GitHub.",
      );
    }

    // Check if the token is still valid
    const isValid = await this.validateGitHubToken(token);
    if (isValid) {
      return token;
    }

    // Token is invalid, attempt refresh
    const newToken = await this.refreshGitHubToken(userId);
    if (newToken) {
      return newToken;
    }

    throw new GitHubTokenExpiredError(
      "GitHub token has expired and could not be refreshed. Please re-authenticate.",
    );
  }
}
