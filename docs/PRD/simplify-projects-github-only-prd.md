# PRD: Simplify Projects to GitHub-Only Integration

**Status:** Superseded
**Superseded By:** [github-oauth-and-repo-picker-prd.md](github-oauth-and-repo-picker-prd.md)
**Author:** Product Team
**Date:** 2026-02-27
**Version:** 1.1

---

## 1. Product Summary

### Problem Statement

The current project and submission architecture is over-engineered for actual usage. Projects require configuration for four integration platforms (Confluence, Jira, Git/GitHub, Beads), and the submission pipeline attempts a sequential 4-step process across all four. In practice:

- **No executors are wired up** — the `SubmissionPipelineService` receives an empty executor map, so all submission steps would fail
- **Confluence, Jira, and Beads are unnecessary** for the core use case — product managers want to write a PRD and get it into the codebase
- **The ProjectForm exposes 4 optional integration fields** that confuse users who only need GitHub
- **Integration tokens are stored globally** in `GlobalSettings`, requiring admin setup for services that may never be used
- **The 4-step submission UI** (SubmissionProgress) shows steps for systems that aren't configured

### Proposed Solution

Simplify the entire project and submission model to **GitHub-only**:

- **Projects** require only a name, description, and GitHub repository (`owner/repo`)
- **Submitting a PRD** means committing the PRD markdown to the GitHub repository (via the existing `git-service.ts` GitHub API integration)
- **Remove** Confluence, Jira, and Beads integration fields from the Project model, submission pipeline, and UI
- **Simplify** the submission flow to a single step: commit PRD to GitHub

### Value Proposition

- **Simpler onboarding** — Create a project by providing a name and a GitHub repo; no Confluence/Jira/Beads configuration
- **Working submission** — The Git service is the most complete integration; wiring it up as the only step makes submission actually functional
- **Reduced complexity** — Remove ~60% of integration code, simplify the pipeline service, and streamline the UI
- **Clear mental model** — "Submit PRD" = "Commit to GitHub". No ambiguity about which systems are involved

---

## 2. User Analysis

### Primary Users

| Persona | Current Pain Point | After This Change |
|---------|-------------------|-------------------|
| **Product Manager** | Confused by 4 integration fields when creating a project; submission never works | Creates project with just a name + GitHub repo; submission commits PRD to the repo |
| **Admin** | Must configure global tokens for Confluence, Jira, Git, and Beads; unclear which are required | No global token management needed; users manage their own GitHub PATs |
| **Developer** | Maintains 4 integration services, a 4-step pipeline, and complex config resolution | Maintains one GitHub service and a single-step submission |

### User Journey (After)

1. Each user sets their own GitHub personal access token in their profile settings
2. Product Manager creates a project: enters name, description, `owner/repo` (required), optional default PR labels and reviewers
3. PM writes and refines a PRD via the agent chat
4. PRD goes through review and reaches `APPROVED` status
5. PM clicks "Submit" → PRD markdown is committed to the GitHub repo as a pull request, attributed to the PM's GitHub identity
6. PM receives a link to the GitHub PR with configured labels and reviewers assigned
7. If the PRD is updated and re-submitted, the existing PR is updated (new commit pushed to the same branch)

---

## 3. Goals & Non-Goals

### Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Simplify the Project model to GitHub-only | Project schema has `name`, `description`, `githubRepo` (required), `defaultLabels`, `defaultReviewers` — no Confluence/Jira/Beads fields |
| G2 | Simplify submission to a single GitHub commit step | Submitting an approved PRD creates a PR on the configured GitHub repo |
| G3 | Simplify the ProjectForm UI | Form shows name, description, GitHub repo, default labels, and default reviewers |
| G4 | Per-user GitHub tokens | Each user stores their own GitHub PAT; PRs are attributed to the submitting user |
| G5 | Simplify the submission UI | SubmissionProgress shows a single "Commit to GitHub" step |
| G6 | Wire up the Git service executor | Submission actually works end-to-end |
| G7 | Support re-submission (update existing PR) | Re-submitting an updated PRD pushes a new commit to the existing PR branch |
| G8 | PR labels and reviewers | PRs are created with project-configured labels and reviewer assignments |
| G9 | Remove dead integration code | Confluence, Jira, and Beads services and related code removed |
| G10 | All existing tests updated and passing | `npm test` exits 0 |

### Non-Goals

- **Adding new GitHub features** — No GitHub Issues, GitHub Projects, or GitHub Actions integration in this PRD
- **Multi-repo support** — Each project has one repo; no cross-repo PRD submission
- **Branch strategy configuration** — PRs are created against `main` (the existing default in `git-service.ts`)
- **GitHub App auth / OAuth** — Continue using personal access tokens; GitHub App installation or OAuth login is a future enhancement
- **Configurable file paths** — PRDs are always committed to `docs/prd/<title>.md`; no per-project path override
- **Removing the Beads CLI** — `bd` is used for issue tracking in the dev workflow (CLAUDE.md), not for PRD submission; it stays

---

## 4. Functional Requirements

### FR1: Simplify the Project Database Model

**Description:** Remove integration fields unrelated to GitHub from the `Project` model.

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
+  githubRepo      String          // "owner/repo" format (REQUIRED)
+  defaultLabels   String[]  @default([])  // Default PR labels (e.g., ["prd", "documentation"])
+  defaultReviewers String[] @default([])  // Default PR reviewer GitHub usernames
   createdAt       DateTime        @default(now())
   updatedAt       DateTime        @updatedAt
   prds            Prd[]
   members         ProjectMember[]
 }
```

**Acceptance Criteria:**
- [ ] `Project` model has required `githubRepo` field (replaces `gitRepo`)
- [ ] `Project` model has `defaultLabels` and `defaultReviewers` string array fields
- [ ] `confluenceSpace`, `jiraProject`, `beadsProject` fields removed
- [ ] Migration created and applied (`prisma migrate dev`)
- [ ] Prisma client regenerated

### FR2: Simplify the PRD Model

**Description:** Remove integration artifact fields unrelated to GitHub from the `Prd` model.

**Schema Change:**
```diff
 model Prd {
   ...
-  confluencePageId String?
-  jiraEpicKey      String?
-  gitPrUrl         String?
-  beadsIssueId     String?
+  githubPrUrl      String?        // URL of the submitted PR
+  githubPrNumber   Int?           // PR number for easy reference
   ...
 }
```

**Acceptance Criteria:**
- [ ] `Prd` model has `githubPrUrl` and `githubPrNumber` fields
- [ ] `confluencePageId`, `jiraEpicKey`, `gitPrUrl`, `beadsIssueId` fields removed
- [ ] Migration created and applied

### FR3: Simplify GlobalSettings

**Description:** Remove all integration tokens and config. GitHub tokens are now per-user (see FR3a).

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
- [ ] All integration fields removed from `GlobalSettings`
- [ ] Admin settings page shows only LLM config and workflow settings
- [ ] Admin settings API updated

### FR3a: Per-User GitHub Tokens

**Description:** Each user stores their own GitHub personal access token. PRs are created under the user's GitHub identity, ensuring correct attribution.

**Schema Change:**
```diff
 model User {
   ...
+  githubToken     String?         // User's GitHub PAT (encrypted at rest)
+  githubUsername   String?         // GitHub username (for reviewer matching)
   ...
 }
```

**User Profile API:** Add `PATCH /api/user/profile` endpoint for users to set/update their GitHub token and username.

**User Profile UI:** Add a "GitHub Settings" section to the user profile page with:
- GitHub token (password input with show/hide toggle)
- GitHub username (text input)
- "Verify" button that tests the token against the GitHub API (`GET /user`)

**Token Resolution for Submission:**
1. Use the submitting user's `githubToken`
2. If not set, return error: "Please set your GitHub token in Profile Settings"

**Acceptance Criteria:**
- [ ] `User` model has `githubToken` and `githubUsername` fields
- [ ] User profile API allows setting/updating GitHub token
- [ ] GitHub token is redacted in API responses
- [ ] GitHub token is never logged
- [ ] "Verify" button confirms token validity via GitHub API
- [ ] Submission uses the submitting user's token

### FR4: Simplify the ProjectForm UI

**Description:** Update the project creation/edit form to show only relevant fields.

**Current Fields:**
- Name (required)
- Description
- Confluence Space
- Jira Project
- Git Repo
- Beads Project

**New Fields:**
- Name (required)
- Description
- GitHub Repository (required, `owner/repo` format, with validation)
- Default PR Labels (optional, comma-separated or tag input, e.g., `prd, documentation`)
- Default PR Reviewers (optional, comma-separated GitHub usernames, e.g., `octocat, hubot`)

**Acceptance Criteria:**
- [ ] ProjectForm shows name, description, GitHub repo, default labels, and default reviewers
- [ ] GitHub repo is required; form cannot be submitted without it
- [ ] GitHub repo field has placeholder text: `e.g., myorg/my-repo`
- [ ] Client-side validation: repo matches `owner/repo` pattern
- [ ] Labels field accepts comma-separated values or tag-style input
- [ ] Reviewers field accepts comma-separated GitHub usernames
- [ ] Integration Settings fieldset removed

### FR5: Simplify the Submission Pipeline

**Description:** Replace the 4-step pipeline with a single GitHub commit step.

**Current Pipeline:**
1. Confluence → create/update page
2. Jira → create/update epic
3. Git → create PR
4. Beads → create issue

**New Pipeline:**
1. GitHub → create PR (commit PRD markdown to repo)

**Implementation Details:**
- Reuse the existing `GitService.createPr()` method — it already handles:
  - Getting the base branch SHA
  - Creating a feature branch
  - Committing a file (base64 encoded content)
  - Opening a pull request
- Wire the `GitService` as the executor in the submission pipeline
- Resolve config: `githubRepo` from Project, `githubToken` from submitting User
- On success: store `githubPrUrl` and `githubPrNumber` on the PRD record
- Transition PRD status to `SUBMITTED`

**PR Details:**
- Branch name: `prd/<slugified-title>` (stable across re-submissions)
- File path: `docs/prd/<slugified-title>.md` (fixed convention)
- PR title: `PRD: <prd-title>`
- PR body: First 500 chars of PRD content as summary
- Base branch: `main`
- Labels: Applied from `project.defaultLabels` via GitHub API (`POST /repos/{owner}/{repo}/issues/{number}/labels`)
- Reviewers: Assigned from `project.defaultReviewers` via GitHub API (`POST /repos/{owner}/{repo}/pulls/{number}/requested_reviewers`)

**Re-submission Behavior:**
- If a PRD already has a `githubPrUrl` and `githubPrNumber`, re-submission **updates the existing PR**:
  1. Check if the branch `prd/<slugified-title>` exists
  2. If yes: update the file on the existing branch (PUT with the existing file SHA)
  3. The PR is automatically updated with the new commit
  4. Update `githubPrUrl` if needed (should remain the same)
- If the branch or PR was deleted: create a new branch and PR (fresh submission)

**Acceptance Criteria:**
- [ ] Submitting an approved PRD creates a GitHub PR using the submitting user's token
- [ ] PRD record updated with `githubPrUrl` and `githubPrNumber`
- [ ] PRD status transitions to `SUBMITTED` on success
- [ ] PR is created with project-configured labels
- [ ] PR is created with project-configured reviewers assigned
- [ ] Re-submitting an already-submitted PRD updates the existing PR (new commit)
- [ ] Audit entry logged for submission
- [ ] Meaningful error message if user's GitHub token not configured
- [ ] Meaningful error message if `githubRepo` not set on project (should not happen since field is required)

### FR6: Simplify the Submission UI

**Description:** Update SubmissionProgress and SubmissionModal to show a single GitHub step.

**Current UI:** 4-step horizontal stepper (Confluence → Jira → Git → Beads)

**New UI:** Single-step submission with:
- Status indicator (pending → in progress → success / failed)
- On success: clickable link to the GitHub PR
- On failure: error message + retry button

**Acceptance Criteria:**
- [ ] SubmissionProgress shows one step: "Commit to GitHub"
- [ ] Success state shows link to PR (opens in new tab)
- [ ] Failed state shows error and retry button
- [ ] SubmissionModal updated to match single-step flow

### FR7: Remove Dead Integration Code

**Description:** Remove Confluence, Jira, and Beads integration services and related code.

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
- `src/services/integration-config-service.ts` — simplify to GitHub-only config resolution
- `src/services/submission-pipeline-service.ts` — simplify to single-step pipeline
- `src/types/submission.ts` — simplify step types

**Acceptance Criteria:**
- [ ] Confluence, Jira, and Beads service files deleted
- [ ] No imports of removed services remain in the codebase
- [ ] `SubmissionStepName` type is `"github"` only
- [ ] All tests updated and passing

### FR8: Update the Admin Settings Page

**Description:** Remove all integration configuration from admin settings. GitHub tokens are now per-user.

**Current Settings:**
- LLM provider/model/thinking level
- Confluence token/space
- Jira token/project
- Git token/repo
- Beads project
- Block approval on unresolved comments

**New Settings:**
- LLM provider/model/thinking level
- Block approval on unresolved comments

**Acceptance Criteria:**
- [ ] Admin settings page has no integration/token fields
- [ ] LLM and workflow settings continue to work
- [ ] Saving settings persists to `GlobalSettings`

### FR9: User Profile Page with GitHub Settings

**Description:** Add a user profile page where users can manage their GitHub token and username.

**Route:** `/profile` (new page)

**UI:**
- Section: "GitHub Settings"
  - GitHub Token — password input with show/hide toggle
  - GitHub Username — text input
  - "Verify Connection" button — calls GitHub API to validate token, shows success/error
  - "Save" button
- Hint text explaining required token scopes: `repo` for private repos, `public_repo` for public

**Acceptance Criteria:**
- [ ] `/profile` page exists and is accessible from the nav bar
- [ ] Users can set/update their GitHub PAT
- [ ] "Verify Connection" tests the token against GitHub API
- [ ] Token is stored encrypted and never displayed after save (only masked placeholder)
- [ ] Nav bar includes a "Profile" link

---

## 5. Non-Functional Requirements

### NFR1: Data Migration

- Existing `gitRepo` values on Projects must be migrated to `githubRepo`
- Existing `gitPrUrl` values on PRDs must be migrated to `githubPrUrl`
- Existing `gitToken` values in GlobalSettings must be migrated to `githubToken`
- Migration must be reversible (down migration restores old columns)

### NFR2: Error Handling

- If user's `githubToken` is not configured: return `422` with message "Please set your GitHub token in Profile Settings before submitting."
- If GitHub API returns an error: surface the GitHub error message to the user
- If re-submission finds the PR was closed/merged: create a new PR and inform the user

### NFR3: Security

- User `githubToken` must never appear in API responses (redacted)
- User `githubToken` must never appear in client-side code or logs
- User `githubToken` should be encrypted at rest in the database
- GitHub API calls must use HTTPS

### NFR4: Testing

- All existing tests updated to reflect schema changes
- Submission pipeline tests verify end-to-end GitHub PR creation (mocked)
- Integration config tests verify GitHub-only resolution

---

## 6. Acceptance Criteria Summary

| # | Criterion | Verification |
|---|-----------|-------------|
| AC1 | Project model has `githubRepo` (required), `defaultLabels`, `defaultReviewers` — no Confluence/Jira/Beads fields | Schema inspection |
| AC2 | PRD model has `githubPrUrl` and `githubPrNumber` (no other integration fields) | Schema inspection |
| AC3 | User model has `githubToken` and `githubUsername` fields | Schema inspection |
| AC4 | GlobalSettings has no integration fields or tokens | Schema inspection |
| AC5 | ProjectForm shows name, description, GitHub repo (required), labels, reviewers | Manual UI test |
| AC6 | User profile page at `/profile` allows setting GitHub token and username | Manual UI test |
| AC7 | "Verify Connection" button validates token against GitHub API | Manual UI test |
| AC8 | Submitting an approved PRD creates a GitHub PR using the user's token | End-to-end test with GitHub API |
| AC9 | PR is created with configured labels and reviewers | GitHub PR inspection |
| AC10 | Re-submitting updates the existing PR (new commit on same branch) | End-to-end test |
| AC11 | PR link displayed in submission UI after success | Manual UI test |
| AC12 | Confluence, Jira, Beads service files deleted | `find` / grep confirms no references |
| AC13 | Admin settings page has no integration fields | Manual UI test |
| AC14 | All tests pass | `npm test` exits 0 |
| AC15 | Data migration preserves existing `gitRepo` values | Migration verification |

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing PRDs have Confluence/Jira/Beads artifact links that will be lost | Low | No executors were wired up, so no real artifact links exist in any environment |
| Future need for Confluence/Jira/Beads integration | Medium | Architecture supports re-adding integrations later; this simplification doesn't prevent future expansion |
| GitHub API rate limiting during bulk submissions | Low | PRD submissions are infrequent; rate limits unlikely to be hit |
| Per-user token management burden | Medium | "Verify Connection" button and clear error messages guide users; token is a one-time setup |
| Token scope confusion | Low | Profile page includes hint text: `repo` scope for private repos, `public_repo` for public |
| Re-submission branch conflicts | Low | Use stable branch names (`prd/<slug>`); check branch existence before creating; handle gracefully if deleted |
| Reviewer usernames may not match GitHub usernames | Low | GitHub API returns an error if reviewer not found; surface this to user with actionable message |

---

## 8. Migration Notes

This is a **simplification** — removing unused complexity, not adding new features. The existing `GitService` (`src/services/integrations/git-service.ts`) already implements the full GitHub PR creation flow and is the only service that needs to be wired into the submission pipeline.

**Estimated scope:**
- 4 schema changes (Project, Prd, User, GlobalSettings) + 1 migration
- 6 files to delete (3 services + 3 test files)
- ~12 files to modify (pipeline, config, forms, admin page, types, submission UI, nav bar)
- ~15 test files to update
- 2 new files (user profile page + API route)

---

## 9. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-27 | Initial draft |
| 1.1 | 2026-02-27 | Refined based on stakeholder feedback: per-user GitHub tokens (replaces global token), required `githubRepo` on projects, PR labels and reviewers support, re-submission updates existing PR, user profile page for GitHub settings, fixed file path convention (`docs/prd/<title>.md`) |
