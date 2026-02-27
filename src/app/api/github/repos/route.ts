/**
 * /api/github/repos - List the authenticated user's GitHub repositories.
 *
 * GET - Fetches repos from GitHub using the stored OAuth access_token,
 *       groups them by owner (user vs organization), and returns the list.
 *
 * TASK-069: Updated to use GitHub-specific error classes for 401/403/404.
 * TASK-070: Token expiration detection and refresh support.
 */
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import {
  classifyGitHubError,
  GitHubTokenExpiredError,
  isGitHubAuthError,
} from "@/lib/github/errors";
import { GitHubTokenService } from "@/lib/github/token-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GitHubRepo {
  name: string;
  full_name: string;
  owner: {
    login: string;
    type: string;
  };
  description: string | null;
  private: boolean;
}

interface RepoEntry {
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
}

interface OwnerGroup {
  owner: string;
  ownerType: string;
  repos: RepoEntry[];
}

// ---------------------------------------------------------------------------
// GET /api/github/repos
// ---------------------------------------------------------------------------

const tokenService = new GitHubTokenService();

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    // Get a valid token, attempting refresh if needed
    let accessToken: string;
    try {
      accessToken = await tokenService.getValidTokenOrRefresh(userId);
    } catch (error) {
      if (error instanceof GitHubTokenExpiredError) {
        return apiError(error.message, 401, {
          error: "token_expired",
          action: "reauthenticate",
          needsReauth: true,
        });
      }
      throw error;
    }

    // Fetch repositories from GitHub
    const ghResponse = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!ghResponse.ok) {
      const body = await ghResponse.json().catch(() => ({}));
      const ghError = classifyGitHubError(ghResponse.status, body);

      if (isGitHubAuthError(ghError)) {
        return apiError(ghError.message, ghResponse.status, {
          error: "token_expired",
          action: "reauthenticate",
          needsReauth: true,
        });
      }

      return apiError(
        `GitHub API error: ${ghResponse.status} ${ghResponse.statusText}`,
        502,
      );
    }

    const repos: GitHubRepo[] = await ghResponse.json();

    // Group repos by owner
    const groupMap = new Map<string, OwnerGroup>();

    for (const repo of repos) {
      const ownerLogin = repo.owner.login;
      const ownerType = repo.owner.type.toLowerCase();

      if (!groupMap.has(ownerLogin)) {
        groupMap.set(ownerLogin, {
          owner: ownerLogin,
          ownerType,
          repos: [],
        });
      }

      groupMap.get(ownerLogin)!.repos.push({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
      });
    }

    const grouped = Array.from(groupMap.values());

    return apiSuccess({ repos: grouped });
  } catch (error) {
    return handleApiError(error);
  }
}
