# PRD: GitHub-Centric Authentication, Projects & Submission

**Status:** Draft
**Author:** Product Team
**Date:** 2026-02-27
**Version:** 2.0

---

## 1. Product Summary

### Problem Statement

The application has three compounding problems:

1. **Wrong auth provider** — Users sign in with Google OAuth, but the entire workflow is GitHub-centric (projects map to repos, submission creates PRs). This forces a two-credential setup: Google for login, separate GitHub PAT for everything else.

2. **Over-engineered integrations** — Projects require configuration for four platforms (Confluence, Jira, Git, Beads). The submission pipeline attempts a sequential 4-step process across all four. In practice, no executors are wired up — submission doesn't work at all.

3. **Manual, error-prone project setup** — Users type `owner/repo` by hand and manually enter project names, leading to misconfiguration and inconsistency.

### Proposed Solution

A single coherent change that addresses all three problems:

1. **Switch from Google OAuth to GitHub OAuth** — Users sign in with GitHub. The OAuth access token (with `repo` scope) is stored by NextAuth and reused for all GitHub API calls. No separate token management.

2. **Simplify to GitHub-only** — Remove Confluence, Jira, and Beads integration fields from all models. Submission becomes a single step: create a GitHub PR.

3. **Repository picker with auto-naming** — Instead of typing repo names, users select from their accessible GitHub repositories via a searchable dropdown. The project name auto-fills from the repo name.

### Value Proposition

- **Single identity** — One GitHub login for authentication and repository access
- **Zero token configuration** — OAuth token handles everything automatically
- **Error-free repo selection** — Pick from real repos; impossible to misconfigure
- **Working submission** — PRD submission actually creates GitHub PRs, end-to-end
- **60% less integration code** — Remove dead Confluence, Jira, and Beads services

### Supersedes

This PRD replaces `simplify-projects-github-only-prd.md` in its entirety. All requirements from that document are incorporated here, with the per-user PAT approach (FR3a, FR9) replaced by OAuth token reuse.

---

## 2. User Analysis

### Primary Users

| Persona | Current Experience | After This Change |
|---------|-------------------|-------------------|
| **Product Manager** | Signs in with Google; configures GitHub PAT separately; types repo name manually; submission never works | Signs in with GitHub; selects repo from dropdown; name auto-fills; submission creates a PR |
| **Admin** | Must configure 4 integration tokens globally; explains two-step credential setup | Manages only LLM settings; onboarding is "Sign in with GitHub" |
| **New User** | Confused by Google login + GitHub PAT + 4 integration fields | Signs in once with GitHub; immediately productive |
| **Developer** | Maintains 4 integration services, 4-step pipeline, complex config resolution | Maintains one GitHub service and single-step submission |

### User Journey (After)

1. User clicks "Sign in with GitHub" on the login page
2. GitHub OAuth consent screen requests `repo`, `read:user`, `user:email` scopes
3. User is authenticated; OAuth token stored in the Account table
4. User navigates to Projects → "Create Project"
5. A searchable dropdown loads the user's GitHub repositories, grouped by owner
6. User selects a repository; project name auto-fills with the repo name (editable)
7. User optionally adds a description, default PR labels, and default reviewers
8. User clicks "Create" → project is created
9. User creates and refines a PRD via the agent chat
10. PRD goes through review and reaches `APPROVED` status
11. User clicks "Submit" → PRD markdown is committed to the repo as a pull request with configured labels and reviewers
12. User receives a link to the GitHub PR
13. If the PRD is updated and re-submitted, the existing PR is updated (new commit on same branch)

---

## 3. Goals & Non-Goals

### Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Replace Google OAuth with GitHub OAuth | Login page shows "Sign in with GitHub"; Google provider removed |
| G2 | Request `repo` scope; reuse OAuth token for API calls | OAuth token stored in Account table; used for repo listing and PR creation |
| G3 | Repository picker on project creation | Searchable dropdown lists user's repos grouped by owner |
| G4 | Auto-populate project name from repo | Selecting a repo fills project name with repo name (editable) |
| G5 | Enforce 1:1 repo-to-project mapping | Unique constraint on `githubRepo`; cannot link same repo to two projects |
| G6 | Simplify Project model to GitHub-only | Remove Confluence/Jira/Beads fields; add `githubRepo` (required), `defaultLabels`, `defaultReviewers` |
| G7 | Simplify PRD model | Replace 4 integration artifact fields with `githubPrUrl` and `githubPrNumber` |
| G8 | Simplify GlobalSettings | Remove all integration tokens and config fields |
| G9 | Single-step GitHub submission | Submitting an approved PRD creates a PR using the user's OAuth token |
| G10 | PR labels and reviewers | PRs created with project-configured labels and reviewer assignments |
| G11 | Re-submission updates existing PR | Re-submitting pushes a new commit to the existing PR branch |
| G12 | Remove dead integration code | Delete Confluence, Jira, Beads services and related code |
| G13 | Handle repo access revocation | Detect and surface clear errors when user loses access to a linked repo |
| G14 | All tests updated and passing | `npm test` exits 0 |

### Non-Goals

- **Multiple OAuth providers** — GitHub is the only provider; no Google fallback
- **GitHub App installation flow** — Continue using OAuth; App installation is a future enhancement
- **Organization-level token management** — Users authenticate individually
- **Repository creation** — Users select existing repos; creating new repos is out of scope
- **Multi-repo projects** — Each project has one repo (1:1)
- **Branch strategy configuration** — PRs target `main` by default
- **Configurable file paths** — PRDs always committed to `docs/prd/<title>.md`
- **Offline token refresh** — GitHub OAuth tokens are long-lived
- **Removing the Beads CLI** — `bd` is used for dev workflow (CLAUDE.md), not PRD submission

---

## 4. Functional Requirements

### FR1: Replace Google OAuth with GitHub OAuth

**Description:** Update NextAuth configuration to use the GitHub OAuth provider.

**Changes to `src/lib/auth/auth.ts`:**
```diff
- import Google from "next-auth/providers/google";
+ import GitHub from "next-auth/providers/github";

  providers: [
-   Google({
-     clientId: process.env.GOOGLE_CLIENT_ID,
-     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
-     profile(profile) {
-       return {
-         id: profile.sub,
-         name: profile.name,
-         email: profile.email,
-         image: profile.picture,
-         oauthId: profile.sub,
-         oauthProvider: "google",
-         role: "AUTHOR",
-       };
-     },
-   }),
+   GitHub({
+     clientId: process.env.GITHUB_CLIENT_ID,
+     clientSecret: process.env.GITHUB_CLIENT_SECRET,
+     authorization: {
+       params: {
+         scope: "repo read:user user:email",
+       },
+     },
+     profile(profile) {
+       return {
+         id: profile.id.toString(),
+         name: profile.name ?? profile.login,
+         email: profile.email,
+         image: profile.avatar_url,
+         oauthId: profile.id.toString(),
+         oauthProvider: "github",
+         role: "AUTHOR",
+       };
+     },
+   }),
  ],
```

**Environment Variable Changes:**
```diff
- GOOGLE_CLIENT_ID=""
- GOOGLE_CLIENT_SECRET=""
+ GITHUB_CLIENT_ID=""
+ GITHUB_CLIENT_SECRET=""
```

**OAuth Scopes:**
- `repo` — Full access to repositories (required for PR creation on private repos)
- `read:user` — Read user profile data
- `user:email` — Access user email (may be private on GitHub)

**Acceptance Criteria:**
- [ ] GitHub OAuth provider configured in NextAuth
- [ ] Google OAuth provider removed
- [ ] `.env.example` updated with `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
- [ ] OAuth consent requests `repo`, `read:user`, `user:email` scopes
- [ ] Successful login stores `access_token` in the Account table
- [ ] User profile populated from GitHub (name, email, avatar, login)

### FR2: Update Login Page UI

**Description:** Replace the Google sign-in button with a GitHub sign-in button.

**Acceptance Criteria:**
- [ ] Login page displays "Continue with GitHub" button with GitHub Octocat logo
- [ ] Clicking initiates GitHub OAuth flow
- [ ] Successful auth redirects to `/dashboard` (or `callbackUrl`)
- [ ] No references to Google remain on the login page

### FR3: GitHub Token Helper

**Description:** Create a server-side helper to retrieve the user's OAuth token from the Account table.

**New file: `src/lib/auth/github-token.ts`**
```typescript
export async function getUserGitHubToken(userId: string): Promise<string | null>
```

- Queries `prisma.account.findFirst({ where: { userId, provider: "github" } })`
- Returns `account.access_token` or `null`
- Exported from `src/lib/auth/index.ts`

**Acceptance Criteria:**
- [ ] Helper retrieves GitHub OAuth token for a given user ID
- [ ] Returns `null` if no GitHub account linked
- [ ] Token never logged or included in API responses

### FR4: Repository Listing API

**Description:** API endpoint that lists the authenticated user's GitHub repositories.

**New endpoint: `GET /api/github/repos`**

**Behavior:**
1. Authenticate the request (`requireAuth()`)
2. Retrieve user's GitHub token via FR3 helper
3. Call `GET https://api.github.com/user/repos?sort=updated&per_page=100&type=all`
4. Return simplified list grouped by owner:
```json
{
  "data": {
    "groups": [
      {
        "owner": "myorg",
        "repos": [
          { "id": 123, "full_name": "myorg/repo-a", "name": "repo-a", "description": "...", "private": true, "default_branch": "main" }
        ]
      },
      {
        "owner": "personal-user",
        "repos": [...]
      }
    ]
  }
}
```

**Query Parameters:**
- `page` (optional) — Pagination support for users with many repos

**Error Handling:**
- No GitHub token: `401` — "GitHub account not linked"
- GitHub API error: `502` — surface GitHub error message

**Acceptance Criteria:**
- [ ] Returns user's repositories grouped by owner (personal vs each org)
- [ ] Response includes `full_name`, `name`, `description`, `private`, `default_branch`
- [ ] Sorted by most recently updated within each group
- [ ] Handles pagination for users with 100+ repos
- [ ] Caches results for 60 seconds to reduce GitHub API calls
- [ ] Returns appropriate error if token is missing or expired

### FR5: Repository Picker Component

**Description:** Searchable repository dropdown for project creation.

**New component: `src/components/projects/RepoPicker.tsx`**

**UI Behavior:**
1. On mount, calls `GET /api/github/repos` to load repositories
2. Displays a searchable combobox:
   - Results grouped by owner with owner name as section header
   - Each option shows: repo `full_name`, lock icon if private
   - Type-ahead filtering (client-side on loaded results)
   - Loading spinner while fetching
   - Empty state: "No repositories found"
   - Error state: "Failed to load repositories" with retry button
3. On selection: fires `onSelect({ fullName, name, description, defaultBranch })` callback

**Acceptance Criteria:**
- [ ] Dropdown loads and displays repos grouped by owner
- [ ] Type-ahead filtering works
- [ ] Loading, empty, and error states implemented
- [ ] Private repos show lock indicator
- [ ] Selecting a repo fires callback with metadata

### FR6: Update Project Creation Flow

**Description:** Replace manual repo text input with RepoPicker; auto-populate project name.

**Changes to ProjectForm:**
- Replace `githubRepo` text input with `<RepoPicker />`
- On repo selection:
  - Set `githubRepo` to `full_name` (e.g., `myorg/my-repo`)
  - Set `name` to repo `name` (e.g., `my-repo`) — editable
  - Set `description` from repo description if field is empty

**Changes to project API:**
- Validate `githubRepo` matches `owner/repo` format
- Enforce unique constraint: reject if another project already uses this repo
- `name` defaults to repo name portion if not provided (server-side fallback)

**Acceptance Criteria:**
- [ ] Project form uses RepoPicker instead of text input
- [ ] Selecting a repo auto-fills project name (editable)
- [ ] Selecting a repo auto-fills description if empty
- [ ] Repos already linked to a project are marked as "already in use" in the picker
- [ ] Form validation ensures a repo is selected
- [ ] Server rejects duplicate `githubRepo` values with a clear error

### FR7: Simplify Project Database Model

**Description:** Remove Confluence/Jira/Beads fields; add GitHub-specific fields.

**Schema Change:**
```diff
 model Project {
   id              String          @id @default(cuid())
   name            String
   description     String?
-  confluenceSpace String?
-  jiraProject     String?
-  gitRepo         String?
-  beadsProject    String?
+  githubRepo      String          @unique  // "owner/repo" format (REQUIRED, UNIQUE)
+  defaultLabels   String[]  @default([])   // Default PR labels
+  defaultReviewers String[] @default([])   // Default PR reviewer GitHub usernames
   createdAt       DateTime        @default(now())
   updatedAt       DateTime        @updatedAt
   prds            Prd[]
   members         ProjectMember[]
 }
```

**Acceptance Criteria:**
- [ ] `githubRepo` is required and has a unique constraint
- [ ] `defaultLabels` and `defaultReviewers` string array fields added
- [ ] Confluence/Jira/Beads fields removed
- [ ] Migration created and applied

### FR8: Simplify PRD Model

**Description:** Remove multi-integration artifact fields.

**Schema Change:**
```diff
 model Prd {
   ...
-  confluencePageId String?
-  jiraEpicKey      String?
-  gitPrUrl         String?
-  beadsIssueId     String?
+  githubPrUrl      String?        // URL of the submitted PR
+  githubPrNumber   Int?           // PR number
+  githubBranch     String?        // Branch name (for re-submission)
   ...
 }
```

**Acceptance Criteria:**
- [ ] `githubPrUrl`, `githubPrNumber`, `githubBranch` fields added
- [ ] Old integration fields removed
- [ ] Migration created and applied

### FR9: Simplify GlobalSettings

**Description:** Remove all integration tokens and config.

**Schema Change:**
```diff
 model GlobalSettings {
   id              String  @id @default("global")
-  confluenceSpace String?
-  jiraProject     String?
-  gitRepo         String?
-  beadsProject    String?
   llmProvider     String  @default("anthropic")
   llmModel        String  @default("claude-sonnet-4-20250514")
   llmThinkingLevel String @default("medium")
   blockApprovalOnUnresolvedComments Boolean @default(true)
-  confluenceToken String?
-  jiraToken       String?
-  gitToken        String?
   updatedAt       DateTime @updatedAt
 }
```

**Acceptance Criteria:**
- [ ] All integration fields removed
- [ ] Admin settings page shows only LLM config and workflow settings

### FR10: Single-Step GitHub Submission

**Description:** Replace the 4-step pipeline with a single GitHub PR step.

**Implementation:**
- Reuse existing `GitService.createPr()` method
- Token resolution: `getUserGitHubToken(session.user.id)` — the OAuth token
- Config resolution: `githubRepo` from Project model
- On success: store `githubPrUrl`, `githubPrNumber`, `githubBranch` on PRD record
- Transition PRD status to `SUBMITTED`

**PR Details:**
- Branch name: `prd/<slugified-title>` (stable across re-submissions)
- File path: `docs/prd/<slugified-title>.md`
- PR title: `PRD: <prd-title>`
- PR body: First 500 chars of PRD content as summary
- Base branch: `main`
- Labels: from `project.defaultLabels`
- Reviewers: from `project.defaultReviewers`

**Re-submission Behavior:**
- If PRD has existing `githubBranch` and `githubPrNumber`:
  1. Check if branch exists (`GET /repos/{owner}/{repo}/git/ref/heads/{branch}`)
  2. If yes: update the file on the existing branch (PUT with file SHA)
  3. PR auto-updates with new commit
- If branch or PR was deleted: create fresh branch and PR

**Acceptance Criteria:**
- [ ] Submitting an approved PRD creates a GitHub PR using the user's OAuth token
- [ ] PRD record updated with `githubPrUrl`, `githubPrNumber`, `githubBranch`
- [ ] PRD status transitions to `SUBMITTED`
- [ ] PR created with configured labels and reviewers
- [ ] Re-submission updates existing PR (new commit on same branch)
- [ ] Audit entry logged
- [ ] Error if OAuth token missing: "Please sign out and sign in again to reconnect your GitHub account"

### FR11: Simplify Submission UI

**Description:** Single-step submission UI.

**New UI:** Replace 4-step stepper with:
- Status indicator (pending → in progress → success / failed)
- On success: clickable link to the GitHub PR
- On failure: error message + retry button

**Acceptance Criteria:**
- [ ] Shows one step: "Commit to GitHub"
- [ ] Success shows PR link (opens in new tab)
- [ ] Failed shows error and retry button

### FR12: Handle Repo Access Revocation

**Description:** Detect and handle when a user loses access to a repo linked to a project.

**Scenarios:**
1. **During repo listing** — Repo won't appear in the picker; no special handling needed
2. **During submission** — GitHub API returns `403` or `404` when trying to create a branch or commit

**Behavior on submission failure due to access loss:**
- Detect `403`/`404` from GitHub API
- Return user-friendly error: "You no longer have access to `owner/repo`. Please contact the repository admin or update the project's repository."
- Do not transition PRD status
- Log the error in audit trail

**Behavior for project listing:**
- Optionally: when loading a project detail page, verify repo access in the background and show a warning banner if access has been lost

**Acceptance Criteria:**
- [ ] Submission failure due to repo access loss returns a clear error message
- [ ] PRD status is not changed on access failure
- [ ] Error is logged in audit trail

### FR13: Handle Token Expiration / Revocation

**Description:** GitHub OAuth tokens can be revoked. Handle gracefully.

**Behavior:**
- If any GitHub API call returns `401`:
  - Return error: "Your GitHub access has expired. Please sign out and sign in again to reconnect."
  - Do not force sign-out
- If Account record has no `access_token`:
  - Return error: "GitHub account not linked. Please sign out and sign in again."

**Acceptance Criteria:**
- [ ] Expired/revoked tokens produce user-friendly error
- [ ] User is not automatically logged out
- [ ] Error includes re-authentication instructions

### FR14: Remove Dead Integration Code

**Description:** Delete Confluence, Jira, and Beads services.

**Files to Remove:**
- `src/services/integrations/confluence-service.ts`
- `src/services/integrations/jira-service.ts`
- `src/services/integrations/beads-service.ts`
- `src/services/integrations/__tests__/confluence-service.test.ts`
- `src/services/integrations/__tests__/jira-service.test.ts`
- `src/services/integrations/__tests__/beads-service.test.ts`

**Files to Simplify:**
- `src/services/integrations/types.ts` — remove Confluence/Jira/Beads types
- `src/services/integrations/index.ts` — remove exports
- `src/services/integration-config-service.ts` — simplify to GitHub-only
- `src/services/submission-pipeline-service.ts` — single-step pipeline
- `src/types/submission.ts` — `SubmissionStepName` is `"github"` only

**Acceptance Criteria:**
- [ ] Dead service files deleted
- [ ] No imports of removed services remain
- [ ] All tests updated and passing

### FR15: Update Admin Settings Page

**Description:** Remove integration config from admin settings.

**New Settings (remaining):**
- LLM provider/model/thinking level
- Block approval on unresolved comments

**Acceptance Criteria:**
- [ ] Admin settings page has no integration/token fields
- [ ] LLM and workflow settings continue to work

---

## 5. Non-Functional Requirements

### NFR1: OAuth Scope Security

- Request minimum scopes: `repo`, `read:user`, `user:email`
- Document why `repo` is required (PR creation on private repos)
- Never request scopes beyond what the application uses

### NFR2: Token Security

- OAuth `access_token` in Account table must never appear in API responses
- OAuth `access_token` must never be logged (even at debug level)
- All GitHub API calls must use HTTPS
- Token is only accessed server-side; never sent to the client

### NFR3: Performance

- `GET /api/github/repos` should respond within 2 seconds for users with up to 200 repos
- Cache repo list for 60 seconds server-side
- RepoPicker filters client-side after initial load (no API call per keystroke)

### NFR4: Data Migration

- Existing Google-authenticated users will need to re-register with GitHub
- For development: `prisma migrate reset` is sufficient
- Existing `gitRepo` values on Projects migrated to `githubRepo`
- Existing `gitPrUrl` values on PRDs migrated to `githubPrUrl`

### NFR5: Testing

- All auth-related tests updated to mock GitHub provider
- New tests for `getUserGitHubToken` helper
- New tests for `GET /api/github/repos` endpoint
- RepoPicker component tests with mocked API responses
- Submission tests verify OAuth token retrieval from Account table
- Repo uniqueness constraint tested

---

## 6. Acceptance Criteria Summary

| # | Criterion | Verification |
|---|-----------|-------------|
| AC1 | Login page shows "Continue with GitHub" (no Google) | Manual UI test |
| AC2 | GitHub OAuth stores `access_token` in Account table | DB inspection after login |
| AC3 | `GET /api/github/repos` returns repos grouped by owner | API test |
| AC4 | Project form shows searchable repo picker dropdown | Manual UI test |
| AC5 | Selecting a repo auto-fills project name | Manual UI test |
| AC6 | Same repo cannot be linked to two projects | API test (unique constraint) |
| AC7 | Project model has `githubRepo` (required, unique), `defaultLabels`, `defaultReviewers` | Schema inspection |
| AC8 | PRD model has `githubPrUrl`, `githubPrNumber`, `githubBranch` | Schema inspection |
| AC9 | GlobalSettings has no integration fields | Schema inspection |
| AC10 | Submitting approved PRD creates GitHub PR using OAuth token | End-to-end test |
| AC11 | PR created with configured labels and reviewers | GitHub PR inspection |
| AC12 | Re-submission updates existing PR | End-to-end test |
| AC13 | Repo access revocation shows clear error | Manual test |
| AC14 | Token expiration shows re-auth message | Manual test |
| AC15 | Confluence/Jira/Beads service files deleted | Grep confirms no references |
| AC16 | Admin settings has no integration fields | Manual UI test |
| AC17 | All tests pass | `npm test` exits 0 |

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `repo` scope grants broad private repo access | Medium | Document clearly in consent screen; required for private repo PR creation |
| GitHub token revocation breaks submission | Medium | Detect 401; show clear re-auth instructions |
| Users with 100+ repos see slow picker | Low | Paginate API calls; cache 60s; client-side filtering |
| Existing Google users locked out | Medium | Communicate migration; dev envs use `prisma migrate reset` |
| GitHub rate limiting | Low | Cache repo list; 5,000 req/hour limit unlikely to be hit |
| User email is private on GitHub | Low | Request `user:email` scope; fall back to noreply address |
| Repo access revoked after project creation | Medium | Detect 403/404 on submission; show actionable error message |
| Re-submission branch conflicts | Low | Stable branch names; check existence before creating; handle deleted branches |
| Reviewer usernames don't match GitHub | Low | GitHub API errors surfaced to user with actionable message |

---

## 8. Implementation Notes

### GitHub OAuth App Setup

Create a GitHub OAuth App at `https://github.com/settings/developers`:
- **Application name:** PRD Web Agent
- **Homepage URL:** `http://localhost:3000` (dev) or production URL
- **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`

### Key Architectural Decision: OAuth Token vs PAT

This PRD uses the **OAuth access token** (stored by NextAuth in the Account table) rather than per-user PATs:

| | OAuth Token | Per-User PAT |
|---|---|---|
| User setup | Zero — automatic at login | Must generate and paste manually |
| Scope control | Fixed at consent time | User chooses at generation |
| Attribution | Tied to GitHub identity | Tied to GitHub identity |
| Revocation | Revoke OAuth app in GitHub settings | Revoke individual token |
| Re-auth | Sign out and back in | Generate new token, paste again |

**Decision:** OAuth token. The zero-configuration benefit outweighs the minor inconvenience of re-authenticating to change scopes.

---

## 9. File Impact Summary

### New Files (5)
- `src/lib/auth/github-token.ts` — OAuth token retrieval helper
- `src/app/api/github/repos/route.ts` — Repository listing API
- `src/components/projects/RepoPicker.tsx` — Searchable repo dropdown
- Related test files for above

### Modified Files (~15)
- `src/lib/auth/auth.ts` — Swap Google → GitHub provider
- `src/lib/auth/index.ts` — Export `getUserGitHubToken`
- `src/app/(auth)/login/page.tsx` — GitHub button and branding
- `src/components/projects/ProjectForm.tsx` — RepoPicker + auto-fill
- `src/app/api/projects/route.ts` — Validation + unique constraint
- `prisma/schema.prisma` — Project, Prd, GlobalSettings changes
- `src/services/submission-pipeline-service.ts` — Single-step pipeline
- `src/services/integration-config-service.ts` — GitHub-only config
- `src/services/integrations/types.ts` — Simplified types
- `src/types/submission.ts` — `"github"` step only
- `src/components/submission/SubmissionProgress.tsx` — Single-step UI
- `src/components/submission/SubmissionModal.tsx` — Simplified modal
- `src/app/admin/settings/page.tsx` — Remove integration fields
- `.env.example` — GitHub credentials
- Related test files

### Files to Delete (6)
- `src/services/integrations/confluence-service.ts`
- `src/services/integrations/jira-service.ts`
- `src/services/integrations/beads-service.ts`
- `src/services/integrations/__tests__/confluence-service.test.ts`
- `src/services/integrations/__tests__/jira-service.test.ts`
- `src/services/integrations/__tests__/beads-service.test.ts`

### No Changes Needed
- `src/middleware.ts` — Route protection unchanged
- `src/app/api/auth/[...nextauth]/route.ts` — Still exports `handlers`
- Account model in schema — Already has `access_token` field

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-27 | Initial draft — GitHub OAuth + repo picker |
| 2.0 | 2026-02-27 | Merged with `simplify-projects-github-only-prd.md`; added: repo picker grouped by owner, 1:1 repo-to-project unique constraint, repo access revocation handling, `githubBranch` field on PRD for re-submission tracking, superseded per-user PAT approach with OAuth token reuse |
