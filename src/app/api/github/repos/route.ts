/**
 * /api/github/repos - List the authenticated user's GitHub repositories.
 *
 * GET - Fetches repos from GitHub using the stored OAuth access_token,
 *       groups them by owner (user vs organization), and returns the list.
 */
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";

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

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    // Look up the GitHub OAuth account for this user
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "github",
      },
    });

    if (!account || !account.access_token) {
      const message = !account
        ? "GitHub account not linked"
        : "GitHub access token not available";
      return apiError(message, 401);
    }

    // Fetch repositories from GitHub
    const ghResponse = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated",
      {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!ghResponse.ok) {
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
