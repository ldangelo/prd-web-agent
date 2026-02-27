# Technical Requirements Document (TRD) — PRD Web Agent

> **Version:** 4.0
> **Last Updated:** 2026-02-27
> **Status:** Draft
> **PRD References:**
> - [docs/PRD/prd-web-agent-prd.md](../PRD/prd-web-agent-prd.md) (v2.0) — Original PRD
> - [docs/PRD/github-oauth-and-repo-picker-prd.md](../PRD/github-oauth-and-repo-picker-prd.md) (v2.0) — GitHub-centric auth, projects & submission
> - [docs/PRD/shadcn-ui-adoption-prd.md](../PRD/shadcn-ui-adoption-prd.md) (v1.0) — shadcn/ui component library adoption

---

## Table of Contents

1. [Master Task List](#master-task-list)
2. [System Architecture](#system-architecture)
3. [Infrastructure Sizing](#infrastructure-sizing)
4. [Data Model](#data-model)
5. [Component Design](#component-design)
6. [API Design](#api-design)
7. [Agent Integration](#agent-integration)
8. [Submission Pipeline](#submission-pipeline)
9. [Error Handling & Recovery](#error-handling--recovery)
10. [Sprint Planning](#sprint-planning)
11. [Testing Strategy](#testing-strategy)
12. [Quality Requirements](#quality-requirements)
13. [Acceptance Criteria](#acceptance-criteria)

---

## Master Task List

### Sprint 1: Foundation (Weeks 1–2)

- [x] **TASK-001:** Initialize Next.js 14+ project with TypeScript, App Router, and Tailwind CSS
- [x] **TASK-002:** Design and implement PostgreSQL database schema (users, projects, prds, versions, comments, notifications, audit_log)
- [x] **TASK-003:** Set up Prisma ORM with migrations for all tables
- [x] **TASK-004:** Implement OAuth 2.0 / SSO authentication via NextAuth.js (configurable provider: Google, Okta, Azure AD)
- [x] **TASK-005:** Implement role-based access control middleware (Author, Reviewer, Admin)
- [x] **TASK-006:** Create base API route structure with error handling, request validation (Zod), and response formatting
- [x] **TASK-007:** Set up OpenTelemetry SDK — tracing, structured logging, metrics exporter
- [x] **TASK-008:** Create Docker multi-stage build (Dockerfile) for production deployment
- [x] **TASK-009:** Set up development environment (docker-compose for local PostgreSQL, Redis, OpenSearch, hot reload, env config)

**Dependencies:** None — all tasks can be parallelized after TASK-001.

### Sprint 2: Core Agent Integration (Weeks 3–4)

- [x] **TASK-010:** Implement pi SDK server-side service — `AgentSessionManager` class that creates/manages per-user `AgentSession` instances with 2-hour idle eviction and cold resume from EFS
- [x] **TASK-011:** Implement custom `ResourceLoader` that loads only `create-prd` and `refine-prd` skills with scoped system prompt
- [x] **TASK-012:** Implement custom agent tools: `save_prd`, `list_prds`, `read_prd` via pi SDK `customTools`; configure read-only codebase tools (`createReadOnlyTools`) scoped to the project's repo clone directory on EFS
- [x] **TASK-012a:** Implement `RepoCloneService` — clone project's Git repo to EFS at `/efs/repos/<project-id>/` on project creation/config; periodic sync via `git pull` (every 15 min cron); on-demand sync before agent session start; sparse clone for large repos
- [x] **TASK-013:** Implement WebSocket server (Socket.io) with Redis adapter for multi-pod support and ALB sticky session configuration
- [x] **TASK-014:** Implement agent session persistence — pi `SessionManager` with EFS shared storage; cold resume logic for reconnection after pod restart
- [x] **TASK-015:** Build chat UI component — message list, input box, streaming text display, image attachment support, LLM error display with retry button
- [x] **TASK-016:** Implement "New PRD" flow — project selection → description input → agent session creation → chat
- [x] **TASK-017:** Implement "Refine PRD" flow — load existing PRD content into agent context → chat
- [x] **TASK-018:** Implement agent session resume — reconnect to in-progress conversation after browser close/reopen via EFS session files

**Dependencies:** TASK-010 depends on TASK-001, TASK-003. TASK-015 depends on TASK-013. TASK-016 depends on TASK-010, TASK-011, TASK-012, TASK-015. TASK-017 depends on TASK-016.

### Sprint 3: PRD & Project Management (Weeks 5–6)

- [x] **TASK-019:** Build Projects UI — list, create, edit, configure (reviewers, integration overrides)
- [x] **TASK-020:** Implement Projects API — CRUD endpoints with validation
- [x] **TASK-021:** Build PRD Dashboard — flat list view with columns (Title, Project, Author, Status, Tags, Updated, Version)
- [x] **TASK-022:** Set up AWS OpenSearch domain; implement index sync (index PRD content on version save); implement search API querying OpenSearch with fuzzy matching and relevance ranking
- [x] **TASK-023:** Build PRD Detail View — Markdown-to-HTML rendering with table of contents
- [x] **TASK-024:** Implement PRD version history API and UI — chronological version list with timestamps and change summaries
- [x] **TASK-025:** Implement tags/labels — API and UI for adding, editing, removing free-form tags
- [x] **TASK-026:** Implement PRD ownership model — primary author, co-authors, access control enforcement

**Dependencies:** TASK-019, TASK-020 depend on TASK-003, TASK-004. TASK-021–TASK-026 depend on TASK-020.

### Sprint 4: Workflow & Collaboration (Weeks 7–8)

- [x] **TASK-027:** Implement status workflow state machine — Draft → In Review → Approved → Submitted with rejection and re-open paths
- [x] **TASK-028:** Implement reviewer auto-assignment — pull reviewers from project config on status transition to "In Review"
- [x] **TASK-029:** Implement document-level comments API — create, reply, resolve, list (threaded)
- [x] **TASK-030:** Build comments UI component — threaded view, resolve/unresolve, compose
- [x] **TASK-031:** Implement "unresolved comments block approval" logic (configurable via admin settings)
- [x] **TASK-032:** Implement in-app notifications system — database as source of truth, real-time push via Socket.io (best-effort), unread count, fetch-on-login for offline delivery
- [x] **TASK-033:** Build notifications UI — bell icon, dropdown, mark-as-read, click-to-navigate
- [x] **TASK-034:** Implement status transition audit trail — log every transition with user, timestamp, comment
- [x] **TASK-035:** Build status workflow UI — status badge, transition buttons with confirmation, audit trail view

**Dependencies:** TASK-027 depends on TASK-003. TASK-028 depends on TASK-020, TASK-027. TASK-031 depends on TASK-029, TASK-027. TASK-032 depends on TASK-027, TASK-029.

### Sprint 5: Submission Pipeline (Weeks 9–10)

- [x] **TASK-036:** Implement Confluence integration service — Markdown-to-Confluence conversion via library (`markdown-it` + custom Confluence renderer); create page, update page on re-submission
- [x] **TASK-037:** Implement Jira integration service — create Epic with summary, acceptance criteria in description, and Confluence link; update existing Epic on re-submission
- [x] **TASK-038:** Implement Git integration service — branch `prd/<prd-id>-<slugified-title>`, commit PRD to `docs/PRD/<title>-prd.md`, open PR; stacked PRs on re-submission (new branch + new PR each time)
- [x] **TASK-039:** Implement Beads integration service — create issue via `bd create` with links to Confluence and Jira
- [x] **TASK-040:** Implement submission pipeline orchestrator — sequential step execution with per-step status tracking, partial failure handling, individual retry
- [x] **TASK-041:** Build submission pipeline UI — progress stepper (pending → in progress → success/failed), retry buttons for failed steps, artifact link display
- [x] **TASK-042:** Implement global + per-project integration settings storage and resolution (project overrides global defaults)
- [x] **TASK-043:** Build admin integration settings UI — global defaults page + per-project override fields
- [x] **TASK-044:** Store artifact links (Confluence page ID, Jira key, PR URL, Beads issue ID) on PRD for re-submission updates

**Dependencies:** TASK-036–TASK-039 can be parallelized. TASK-040 depends on TASK-036–TASK-039. TASK-041 depends on TASK-040. TASK-042 depends on TASK-020. TASK-044 depends on TASK-040.

### Sprint 6: Admin, Observability & Deployment (Weeks 11–12)

- [x] **TASK-045:** Build admin settings page — user management (add/remove, assign roles), LLM configuration (model, thinking level), workflow settings
- [x] **TASK-046:** Implement LLM admin configuration — persist model/provider selection, apply to new agent sessions
- [x] **TASK-047:** Add OpenTelemetry trace instrumentation to all API routes, database queries, LLM calls, external API calls, and agent session lifecycle
- [x] **TASK-048:** Implement custom OTel metrics — `prd_count_by_status` gauge, `agent_session_active` gauge, `agent_session_idle_evictions_total` counter, `submission_pipeline_duration` histogram, `submission_step_success_total` counter
- [x] **TASK-049:** Configure structured JSON logging (pino) with trace ID / span ID correlation via OTel log bridge
- [x] **TASK-050:** Create Helm chart for AWS EKS deployment (backend deployment, service, ingress with sticky sessions, HPA, configmaps, secrets, EFS PVC, OpenSearch domain reference)
- [x] **TASK-051:** Create CI/CD pipeline (GitHub Actions) — build, test, lint, Docker push, Helm deploy
- [x] **TASK-052:** Implement health check endpoints (`/healthz` readiness with DB + Redis + OpenSearch checks, `/livez` liveness)
- [x] **TASK-053:** Configure Horizontal Pod Autoscaler (HPA) for backend pods based on CPU/memory
- [x] **TASK-054:** Set up OTel Collector deployment in EKS for receiving and exporting traces/metrics/logs
- [x] **TASK-055:** Seed `GlobalSettings` row on first deploy via Prisma seed script with sensible defaults
- [x] **TASK-056:** End-to-end integration testing — full flow from login → create PRD → refine → approve → submit

**Dependencies:** TASK-047–TASK-049 depend on TASK-007. TASK-050–TASK-054 depend on TASK-008. TASK-056 depends on all prior tasks.

### Sprint 7: GitHub-Centric Auth, Projects & Submission (Weeks 13–15)

- [x] **TASK-057:** Switch OAuth provider from Google to GitHub — update NextAuth config, request `repo`, `read:user`, `user:email` scopes, store OAuth token in Account table
- [x] **TASK-058:** Update login page — replace "Sign in with Google" with "Sign in with GitHub", update SVG logo
- [x] **TASK-059:** Create GitHub repo listing API — `GET /api/github/repos` endpoint that uses the user's OAuth token to list accessible repos via GitHub REST API, grouped by owner (user/orgs)
- [x] **TASK-060:** Build RepoPicker component — searchable dropdown with owner grouping, debounced search, loading states; auto-populates project name from repo name
- [x] **TASK-061:** Simplify Project model — remove `confluenceSpace`, `jiraProject`, `beadsProject` fields; add `githubRepo` (required, unique), `defaultLabels` (String[]), `defaultReviewers` (String[]); create Prisma migration
- [x] **TASK-062:** Update Project API — `POST /api/projects` accepts `githubRepo`, `defaultLabels`, `defaultReviewers`; validate repo exists via GitHub API; enforce unique `githubRepo` constraint
- [x] **TASK-063:** Refactor ProjectForm — integrate RepoPicker; remove Confluence/Jira/Beads fields; add labels and reviewers inputs
- [x] **TASK-064:** Simplify PRD model — remove `confluencePageId`, `jiraEpicKey`, `beadsIssueId` fields; add `githubPrUrl`, `githubPrNumber` (Int?), `githubBranch`; create Prisma migration
- [x] **TASK-065:** Simplify GlobalSettings model — remove `confluenceSpace`, `jiraProject`, `gitRepo`, `beadsProject`, `confluenceToken`, `jiraToken`, `gitToken` fields; keep `llmProvider`, `llmModel`, `llmThinkingLevel`, `blockApprovalOnUnresolvedComments`; create Prisma migration
- [x] **TASK-066:** Rewrite submission pipeline — single-step GitHub PR creation using user's OAuth token; branch `prd/<prd-id>-<slug>`, file `docs/PRD/<slug>-prd.md`; add configured labels and reviewers; re-submission pushes new commit to existing branch (no new PR)
- [x] **TASK-067:** Update SubmissionModal — single-step progress UI (no 4-step stepper); show PR link on success
- [x] **TASK-068:** Update RepoCloneService — per-user clones using OAuth token; EFS path `/efs/repos/<user-id>/<project-id>/`; token refresh handling
- [x] **TASK-069:** Handle repo access revocation — detect 403/404 from GitHub API; surface clear error messages; mark project as needing re-auth
- [x] **TASK-070:** Handle OAuth token expiration — detect expired tokens; prompt user to re-authenticate; refresh token if GitHub provides refresh_token
- [x] **TASK-071:** Delete dead integration code — remove ConfluenceService, JiraService, BeadsService, integration-config-service, and all related tests
- [x] **TASK-072:** Update admin settings page — remove integration credential fields; keep LLM config and workflow settings only
- [x] **TASK-073:** Update all affected tests — API route tests, service tests, component tests for auth, projects, submission, admin

**Dependencies:** TASK-057 is prerequisite for all others. TASK-059, TASK-060 depend on TASK-057. TASK-061–TASK-065 can be parallelized. TASK-066 depends on TASK-064. TASK-068 depends on TASK-057. TASK-071 depends on TASK-066.

### Sprint 8: Search Simplification (Week 16)

- [x] **TASK-074:** Replace OpenSearch with PostgreSQL full-text search — add `tsvector` column to PRD table; create GIN index; write search query using `ts_query` with ranking
- [x] **TASK-075:** Update search API — rewrite `GET /api/search` to query PostgreSQL FTS instead of OpenSearch; maintain existing query parameter interface
- [x] **TASK-076:** Remove OpenSearch infrastructure — remove from docker-compose, Helm chart, health checks, and all OpenSearch-related code
- [x] **TASK-077:** Update index sync — replace OpenSearch indexing with tsvector column update trigger on PRD version save
- [x] **TASK-078:** Update search-related tests

**Dependencies:** TASK-074 is prerequisite for TASK-075–TASK-078.

### Sprint 9: shadcn/ui Component Library Adoption (Weeks 17–18)

- [ ] **TASK-079:** Initialize shadcn/ui — run `npx shadcn init`, configure `components.json`, create `cn()` utility in `src/lib/utils.ts`, set up CSS variables in `globals.css`, update `tailwind.config.ts`
- [ ] **TASK-080:** Install core shadcn/ui components — Button, Input, Textarea, Select, Label, Badge, Card, Dialog, AlertDialog, DropdownMenu, Table, Sheet, Separator, Form
- [ ] **TASK-081:** Install `lucide-react` and replace all inline SVG icons across all components
- [ ] **TASK-082:** Migrate form components — refactor ProjectForm, FilterBar, CommentComposer, MessageComposer to use shadcn Input, Textarea, Label, Select, Button
- [ ] **TASK-083:** Migrate dialog components — refactor SubmissionModal and TransitionButtons to use shadcn Dialog/AlertDialog
- [ ] **TASK-084:** Migrate badge components — refactor StatusBadge, TagPill, PrdListItem to use shadcn Badge
- [ ] **TASK-085:** Migrate navigation components — refactor NotificationBell dropdown to shadcn DropdownMenu; add Sheet for mobile nav
- [ ] **TASK-086:** Migrate data display components — refactor Dashboard table to shadcn Table; refactor ProjectCard to shadcn Card
- [ ] **TASK-087:** CSS variable theming — map existing colors to semantic tokens (`--primary`, `--destructive`, `--muted`, etc.); remove hardcoded Tailwind color classes
- [ ] **TASK-088:** Verify all tests pass after migration — fix any test failures from changed markup/classnames
- [ ] **TASK-089:** Accessibility audit — verify keyboard navigation, focus management, ARIA attributes on all migrated components

**Dependencies:** TASK-079 is prerequisite for all others. TASK-080 depends on TASK-079. TASK-081–TASK-087 depend on TASK-080. TASK-088 depends on TASK-081–TASK-087. TASK-089 depends on TASK-088.

---

## System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           AWS EKS Cluster                            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │              Ingress (ALB — sticky sessions via cookie)        │   │
│  │                       HTTPS termination                        │   │
│  └──────────────┬────────────────────────────────┬───────────────┘   │
│                 │                                │                    │
│                 ▼                                ▼                    │
│  ┌──────────────────────────┐    ┌──────────────────────────┐        │
│  │    Next.js App Pod (1)   │    │   Next.js App Pod (N)    │        │
│  │                          │    │   (HPA: 2–5 replicas)    │        │
│  │  ┌────────────────────┐  │    │  ┌────────────────────┐  │        │
│  │  │  React SSR +       │  │    │  │  React SSR +       │  │        │
│  │  │  API Routes        │  │    │  │  API Routes        │  │        │
│  │  └────────────────────┘  │    │  └────────────────────┘  │        │
│  │  ┌────────────────────┐  │    │  ┌────────────────────┐  │        │
│  │  │  WebSocket         │  │    │  │  WebSocket         │  │        │
│  │  │  (Socket.io +      │  │    │  │  (Socket.io +      │  │        │
│  │  │   Redis adapter)   │  │    │  │   Redis adapter)   │  │        │
│  │  └────────────────────┘  │    │  └────────────────────┘  │        │
│  │  ┌────────────────────┐  │    │  ┌────────────────────┐  │        │
│  │  │  Pi SDK            │  │    │  │  Pi SDK            │  │        │
│  │  │  AgentSessions     │  │    │  │  AgentSessions     │  │        │
│  │  │  (in-memory map    │  │    │  │  (in-memory map    │  │        │
│  │  │   2h idle evict)   │  │    │  │   2h idle evict)   │  │        │
│  │  └────────────────────┘  │    │  └────────────────────┘  │        │
│  │  ┌────────────────────┐  │    │  ┌────────────────────┐  │        │
│  │  │  OTel SDK          │  │    │  │  OTel SDK          │  │        │
│  │  └────────────────────┘  │    │  └────────────────────┘  │        │
│  └──────────┬───────────────┘    └──────────┬───────────────┘        │
│             │                               │                         │
│             ▼                               ▼                         │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                      Shared Services                           │   │
│  │                                                                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐                     │   │
│  │  │ AWS RDS  │  │  Redis   │  │ OTel      │                     │   │
│  │  │ Postgres │  │ Elasti-  │  │ Collector │                     │   │
│  │  │ (db.t3.  │  │  Cache   │  │ Pod       │                     │   │
│  │  │  medium) │  │ (cache.  │  │           │                     │   │
│  │  │ + FTS    │  │  t3.micro│  │           │                     │   │
│  │  └──────────┘  └──────────┘  └───────────┘                     │   │
│  │                                                                │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  EFS (Elastic File System)                              │   │   │
│  │  │  ├── /efs/sessions/<user-id>/  — Pi session files       │   │   │
│  │  │  └── /efs/repos/<user-id>/<project-id>/ — Per-user      │   │   │
│  │  │       Git repo clones (OAuth token-scoped)              │   │   │
│  │  │  Mounted as PVC on all app pods (read-write)            │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
               ┌───────────────────────────────────┐
               │        External Services          │
               │                                   │
               │  ┌───────────┐  ┌──────────────┐  │
               │  │ GitHub    │  │  LLM APIs    │  │
               │  │ REST API  │  │  (Anthropic,  │  │
               │  │ (OAuth +  │  │   OpenAI)    │  │
               │  │  repos +  │  │              │  │
               │  │  PRs)     │  │              │  │
               │  └───────────┘  └──────────────┘  │
               └───────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14+ (App Router), React 18, TypeScript 5, Tailwind CSS | SSR for SEO/performance; App Router for modern patterns; Tailwind for rapid UI development |
| **Real-time** | Socket.io (WebSocket with fallback) + Redis adapter | Reliable WebSocket with auto-reconnect, room-based routing, Redis adapter for multi-pod |
| **Backend** | Next.js API Routes + standalone WebSocket server | Unified deployment; API routes for REST, separate WS process for long-lived connections |
| **ORM** | Prisma 5+ | Type-safe database access, migration management, excellent TypeScript integration |
| **Database** | PostgreSQL 15+ (AWS RDS, db.t3.medium) | Mature, reliable, JSONB for flexible fields, stores PRD content and metadata |
| **Search** | PostgreSQL full-text search (tsvector/tsquery + GIN index) | Built-in FTS with ranking; no extra infrastructure; sufficient for ~120 PRDs/year |
| **Cache / PubSub** | Redis 7+ (ElastiCache, cache.t3.micro) | Socket.io adapter for multi-pod WebSocket; notification pub/sub |
| **Agent** | `@mariozechner/pi-coding-agent` SDK | Direct in-process agent sessions; custom tools/skills/resource loader |
| **Auth** | NextAuth.js v5 (Auth.js) | GitHub OAuth with `repo`, `read:user`, `user:email` scopes; OAuth token reused for GitHub API calls |
| **Validation** | Zod | Runtime schema validation; integrates with Prisma and API routes |
| **UI Components** | shadcn/ui (Radix UI + Tailwind CSS + class-variance-authority) | Accessible component primitives; CSS variable theming; zero lock-in (source copied into project) |
| **Observability** | OpenTelemetry SDK (Node.js), pino logger, OTel Collector | Vendor-neutral; traces + metrics + logs; exports to CloudWatch, X-Ray, Prometheus |
| **Containerization** | Docker (multi-stage build) | Consistent builds; minimal production image |
| **Orchestration** | AWS EKS + Helm 3 | Managed Kubernetes; Helm for templated deployments |
| **CI/CD** | GitHub Actions | Build → test → lint → Docker push → Helm deploy |
| **File Storage** | AWS EFS | Shared filesystem for pi session files across pods; mounted as PVC |

### Key Architectural Decisions

| # | Decision | Rationale | Trade-off |
|---|----------|-----------|-----------|
| AD-1 | Pi SDK runs in-process (not RPC subprocess) | Lower latency, type safety, direct event subscription, no IPC overhead | Couples Node.js version to pi SDK; agent crash could affect server (mitigated by per-session isolation) |
| AD-2 | EFS for pi session file storage | Pi `SessionManager` uses file-based `.jsonl` storage; EFS provides shared filesystem across pods | Slightly higher latency than local disk; EFS costs; but avoids rewriting SessionManager |
| AD-3 | ALB sticky sessions (cookie-based) | Agent sessions are in-memory per pod; sticky sessions route users to the same pod | Pod restart loses in-memory sessions; mitigated by cold resume from EFS |
| AD-4 | 2-hour idle eviction for agent sessions | Prevents memory leaks from abandoned sessions; EFS file preserved for cold resume | PM must wait for cold resume after 2h idle; acceptable since conversations are intact |
| AD-5 | Redis for Socket.io adapter | Required for WebSocket message routing across multiple backend pods behind ALB | Additional infrastructure component; but essential for horizontal scaling |
| AD-6 | PRD content stored in PostgreSQL (not just files) | Enables versioning, access control, structured queries, and built-in full-text search via tsvector | Dual storage (DB for content + EFS for pi sessions); but PRD content is small |
| AD-7 | ~~OpenSearch for full-text search~~ **Superseded by AD-20** | Originally chose OpenSearch; now using PostgreSQL FTS (tsvector/tsquery) — adequate for ~120 PRDs/year with no extra infrastructure | — |
| AD-8 | No manual editing of PRD content | Simplifies architecture (no rich text editor); ensures every change has a conversation trail | PMs cannot fix a typo without starting an agent conversation; mitigated by lightweight refinement prompts |
| AD-9 | Single Next.js app (no microservices) | Reduces deployment complexity for v1; monolith is appropriate for team size and feature scope | May need to extract agent service if scaling becomes an issue |
| AD-10 | Tool-level sandboxing (no input filtering) | Agent physically cannot execute bash/edit/write — tools aren't registered; no false-positive risk from prompt filtering | Agent could say inappropriate things via prompt injection, but cannot execute anything dangerous |
| AD-11 | Notifications: DB source of truth + Socket.io best-effort push | PMs never miss notifications; real-time push when connected, fetch-on-login when not | Slight delay for offline users; acceptable — no push notifications needed |
| AD-12 | ~~Library-based Markdown → Confluence conversion~~ **Removed** | Confluence integration eliminated; PRD content submitted as Markdown to GitHub PR | — |
| AD-13 | Mock at model level for agent integration tests | Deterministic, fast, tests full stack (SDK → tools → DB) without HTTP fragility | Less realistic than HTTP-level mocking; but more maintainable and reliable |
| AD-14 | Clone project repos to EFS for agent codebase access | Pi's `create-prd` skill benefits from seeing existing code, architecture, and patterns; EFS is already in the architecture; pi SDK provides `createReadOnlyTools(cwd)` for scoped read-only access | Repo clones consume EFS storage (~1-2 GB per repo); mitigated by small project count (10 projects = <20 GB) |
| AD-15 | Full read-only repo access (no path filtering) | Agent needs to see architecture, configs, READMEs, and code patterns; sensitive files (secrets) should not be in the repo — that's a repo hygiene concern, not an application concern | If a repo contains checked-in secrets, the agent could read them; acceptable risk given the PMs already have repo access |
| AD-16 | S3 rejected for repo storage | Pi's tools expect POSIX filesystem (`read`, `grep`, `find`); S3 is object storage requiring FUSE mount (s3fs) which is unreliable for random reads; EFS provides native filesystem semantics | EFS is slightly more expensive than S3 for storage; but the access pattern (random reads, grep, find) requires a real filesystem |
| AD-17 | GitHub OAuth replaces Google OAuth | Single identity for auth + API access; eliminates separate PAT management; `repo` scope provides repo listing and PR creation | Couples authentication to GitHub; acceptable since the entire workflow is GitHub-centric |
| AD-18 | OAuth token reuse (no separate PAT) | User's GitHub OAuth token from Account table is used for all GitHub API calls (repo listing, PR creation, repo cloning) | Token must have `repo` scope; if user re-authenticates with fewer scopes, API calls fail; mitigated by enforcing scopes at login |
| AD-19 | Per-user repo clones on EFS | Each user's repo clone uses their OAuth token; path `/efs/repos/<user-id>/<project-id>/` | More storage than shared clones; but respects per-user access permissions and avoids stale token issues |
| AD-20 | PostgreSQL FTS replaces OpenSearch | At ~120 PRDs/year, PostgreSQL `tsvector`/`tsquery` with GIN index provides adequate search quality without extra infrastructure | Less sophisticated fuzzy matching than OpenSearch; acceptable trade-off for reduced complexity and cost |
| AD-21 | Single-step GitHub submission | Submission creates one GitHub PR (branch + commit + PR); replaces 4-step Confluence/Jira/Git/Beads pipeline | No cross-platform linking; but Confluence/Jira/Beads were never wired up, so this is net-new working functionality |
| AD-22 | Re-submission updates existing PR | Pushing new commit to existing branch keeps PR conversation history intact | If branch has merge conflicts, user must resolve manually; acceptable for PRD documents |
| AD-23 | shadcn/ui component library | Radix UI primitives with Tailwind CSS; components copied into `src/components/ui/` for full ownership | Learning curve for team; mitigated by shadcn/ui's documentation and in-project source code |
| AD-24 | 1:1 repo-to-project mapping | `githubRepo` field is unique across all projects; prevents duplicate project creation for same repo | Limits flexibility if teams want multiple project views of one repo; acceptable for v1 |

---

## Infrastructure Sizing

### Expected Scale (Year 1)

| Metric | Value |
|--------|-------|
| Active PMs | ~10 |
| PRDs per month | ~10 |
| Concurrent agent sessions (peak) | ~5 |
| PRDs in system (end of year 1) | ~120 |
| Total PRD versions (end of year 1) | ~300–500 |

### Resource Sizing

| Component | Instance | Justification |
|-----------|----------|---------------|
| **App Pods** | 2–5 replicas (HPA), 512Mi–1Gi RAM each | Each agent session consumes ~50–100Mi; 5 concurrent sessions per pod = ~500Mi |
| **RDS PostgreSQL** | db.t3.medium (2 vCPU, 4 GiB RAM) | Handles <1000 queries/min comfortably; auto-scaling storage starts at 20 GiB |
| **ElastiCache Redis** | cache.t3.micro (1 vCPU, 0.5 GiB) | Socket.io adapter + notification pub/sub; minimal load at this scale |
| **EFS** | Bursting throughput mode | Pi session files (~1 MB each, <500 total) + Per-user Git repo clones (~1-2 GB each, ~10 users × ~10 repos = ~100-200 GB worst case, typically much less due to dedup) |
| **ALB** | Standard Application Load Balancer | Handles <100 concurrent connections easily |

### Estimated Monthly Cost (AWS us-east-1)

| Component | Estimate |
|-----------|----------|
| EKS cluster | $73 |
| App pods (2× t3.medium) | $60 |
| RDS PostgreSQL (db.t3.medium) | $50 |
| ElastiCache Redis (cache.t3.micro) | $13 |
| EFS (~50–200 GB per-user repos + sessions) | $15–60 |
| ALB | $20 |
| LLM API costs (variable) | $50–200 |
| **Total** | **~$230–420/month** |

---

## Data Model

### Entity Relationship Diagram

```
┌──────────┐     ┌───────────────┐     ┌──────────────────┐
│  User    │────<│ ProjectMember │>───│   Project        │
│          │     └───────────────┘     │                  │
│ id       │                           │ id               │
│ email    │     ┌───────────┐         │ name             │
│ name     │────<│  PRD      │>───────│ description      │
│ role     │     │           │         │ githubRepo @uniq │
│ avatarUrl│     │ id        │         │ defaultLabels[]  │
│          │     │ title     │         │ defaultReviewers[]│
└──────────┘     │ projectId │         └──────────────────┘
     │           │ authorId  │
     │  Account  │ status    │
     │  (NextAuth│ currentVersion │
     │  OAuth    │ tags[]    │
     │  token)   │ githubPrUrl │
     │           │ githubPrNumber │
     │           │ githubBranch │
     │           └─────┬─────┘
     │                 │
     │           ┌─────┴─────┐
     │           │ PRDVersion│
     │           │           │
     │           │ id        │
     │           │ prdId     │
     │           │ version   │
     │           │ content   │ (Markdown text)
     │           │ changeSummary │
     │           │ authorId  │
     │           │ sessionId │ (pi session reference)
     │           │ createdAt │
     │           └───────────┘
     │
     │           ┌───────────┐
     ├──────────<│  Comment  │
     │           │           │
     │           │ id        │
     │           │ prdId     │
     │           │ authorId  │
     │           │ parentId  │ (null = top-level, ID = reply)
     │           │ body      │
     │           │ resolved  │
     │           │ resolvedBy│
     │           │ createdAt │
     │           └───────────┘
     │
     │           ┌────────────────┐
     ├──────────<│  Notification  │
     │           │                │
     │           │ id             │
     │           │ userId         │
     │           │ type           │
     │           │ prdId          │
     │           │ message        │
     │           │ read           │
     │           │ createdAt      │
     │           └────────────────┘
     │
     │           ┌────────────────┐
     └──────────<│  AuditEntry    │
                 │                │
                 │ id             │
                 │ prdId          │
                 │ userId         │
                 │ action         │
                 │ fromStatus     │
                 │ toStatus       │
                 │ detail (JSON)  │
                 │ createdAt      │
                 └────────────────┘
```

### Prisma Schema (Core Models)

```prisma
enum Role {
  AUTHOR
  REVIEWER
  ADMIN
}

enum PrdStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  SUBMITTED
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  name          String?
  role          Role           @default(AUTHOR)
  avatarUrl     String?
  oauthId       String?        @unique
  oauthProvider String?
  emailVerified DateTime?
  image         String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  accounts      Account[]      // NextAuth OAuth accounts (stores GitHub access_token)
  sessions      Session[]      // NextAuth sessions
  prds          Prd[]          @relation("PrdAuthor")
  coAuthoredPrds PrdCoAuthor[]
  comments      Comment[]
  notifications Notification[]
  auditEntries  AuditEntry[]
  projectMemberships ProjectMember[]
}

// NextAuth models for OAuth token storage
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String   // "github"
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text  // GitHub OAuth token — reused for API calls
  expires_at        Int?
  token_type        String?
  scope             String?  // "repo,read:user,user:email"
  id_token          String? @db.Text
  session_state     String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

model Project {
  id               String          @id @default(cuid())
  name             String
  description      String?
  githubRepo       String          @unique  // "owner/repo" format; required; 1:1 mapping
  defaultLabels    String[]        @default([])  // PR labels applied on submission
  defaultReviewers String[]        @default([])  // GitHub usernames assigned as PR reviewers
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  prds            Prd[]
  members         ProjectMember[]
}

model ProjectMember {
  id        String   @id @default(cuid())
  projectId String
  userId    String
  isReviewer Boolean @default(false)

  project   Project  @relation(fields: [projectId], references: [id])
  user      User     @relation(fields: [userId], references: [id])

  @@unique([projectId, userId])
}

model Prd {
  id              String      @id @default(cuid())
  title           String
  projectId       String
  authorId        String
  status          PrdStatus   @default(DRAFT)
  currentVersion  Int         @default(1)
  tags            String[]    @default([])
  // GitHub submission artifact links (populated after submission)
  githubPrUrl     String?     // Full URL to the GitHub PR
  githubPrNumber  Int?        // PR number for re-submission (push new commit)
  githubBranch    String?     // Branch name for re-submission
  // Full-text search vector (auto-updated on version save)
  searchVector    Unsupported("tsvector")?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  project         Project     @relation(fields: [projectId], references: [id])
  author          User        @relation("PrdAuthor", fields: [authorId], references: [id])
  coAuthors       PrdCoAuthor[]
  versions        PrdVersion[]
  comments        Comment[]
  notifications   Notification[]
  auditEntries    AuditEntry[]

  @@index([searchVector], type: Gin)
}

model PrdCoAuthor {
  id      String @id @default(cuid())
  prdId   String
  userId  String

  prd     Prd    @relation(fields: [prdId], references: [id])
  user    User   @relation(fields: [userId], references: [id])

  @@unique([prdId, userId])
}

model PrdVersion {
  id            String   @id @default(cuid())
  prdId         String
  version       Int
  content       String   // Full Markdown content
  changeSummary String?
  authorId      String
  sessionId     String?  // Pi agent session reference
  createdAt     DateTime @default(now())

  prd           Prd      @relation(fields: [prdId], references: [id])
}

model Comment {
  id         String    @id @default(cuid())
  prdId      String
  authorId   String
  parentId   String?   // null = top-level; populated = threaded reply
  body       String
  resolved   Boolean   @default(false)
  resolvedBy String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  prd        Prd       @relation(fields: [prdId], references: [id])
  author     User      @relation(fields: [authorId], references: [id])
  parent     Comment?  @relation("CommentThread", fields: [parentId], references: [id])
  replies    Comment[] @relation("CommentThread")
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  prdId     String?
  type      String   // review_requested, comment, approved, rejected, submitted
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id])
  prd       Prd?     @relation(fields: [prdId], references: [id])
}

model AuditEntry {
  id         String   @id @default(cuid())
  prdId      String?
  userId     String
  action     String   // status_change, submission, comment, version_created
  fromStatus String?
  toStatus   String?
  detail     Json?
  createdAt  DateTime @default(now())

  prd        Prd?     @relation(fields: [prdId], references: [id])
  user       User     @relation(fields: [userId], references: [id])
}

model GlobalSettings {
  id              String  @id @default("global")
  llmProvider     String  @default("anthropic")
  llmModel        String  @default("claude-sonnet-4-20250514")
  llmThinkingLevel String @default("medium")
  blockApprovalOnUnresolvedComments Boolean @default(true)
  updatedAt       DateTime @updatedAt
}
```

### PostgreSQL Full-Text Search

```sql
-- Add tsvector column and GIN index (via Prisma migration with raw SQL)
ALTER TABLE "Prd" ADD COLUMN "searchVector" tsvector;
CREATE INDEX "Prd_searchVector_idx" ON "Prd" USING GIN ("searchVector");

-- Update trigger: auto-update searchVector on PRD version save
CREATE OR REPLACE FUNCTION update_prd_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Prd"
  SET "searchVector" = setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
                        setweight(to_tsvector('english', COALESCE(
                          (SELECT content FROM "PrdVersion" WHERE "prdId" = NEW.id ORDER BY version DESC LIMIT 1),
                          ''
                        )), 'B')
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Search Query Pattern:**
```sql
SELECT p.*, ts_rank(p."searchVector", query) AS rank
FROM "Prd" p, plainto_tsquery('english', $1) query
WHERE p."searchVector" @@ query
ORDER BY rank DESC
LIMIT 20;
```

**Sync Strategy:**
- On every `PrdVersion` save → update `searchVector` column on the parent PRD (via Prisma `$executeRaw` or DB trigger)
- On PRD title/tag change → re-compute `searchVector`
- No external infrastructure needed; search is always consistent with the database

---

## Component Design

### Frontend Component Hierarchy

```
App (Layout)
├── NavBar (server component — reads session via auth())
│   ├── NavLinks (client — Dashboard, Projects, New PRD, Admin)
│   ├── NotificationBell (unread count + DropdownMenu)
│   ├── UserMenu (avatar, name, signOut)
│   └── MobileMenuButton (hamburger toggle + Sheet drawer)
├── Pages
│   ├── /dashboard
│   │   ├── PrdListView (flat list with sort/filter)
│   │   │   ├── FilterBar (project, status, author, tags — shadcn Select/Input)
│   │   │   ├── SearchBar (queries PostgreSQL FTS with debounce)
│   │   │   └── PrdListItem[] (shadcn Table rows — title, project, Badge, tags, updated)
│   │   └── EmptyState
│   ├── /projects
│   │   ├── ProjectList (shadcn Card grid)
│   │   └── /projects/new
│   │       └── ProjectForm
│   │           ├── RepoPicker (searchable dropdown — GitHub repos grouped by owner)
│   │           ├── Name Input (auto-filled from repo name, editable)
│   │           ├── Description Textarea
│   │           ├── Labels Input (default PR labels)
│   │           └── Reviewers Input (default PR reviewers)
│   ├── /prd/[id]
│   │   ├── PrdHeader (title, StatusBadge, actions)
│   │   ├── TabNavigation (Document, Chat, Comments, History)
│   │   ├── DocumentTab
│   │   │   └── MarkdownRenderer (rendered HTML with TOC, via react-markdown + remark-gfm)
│   │   ├── ChatTab
│   │   │   └── ChatInterface
│   │   │       ├── MessageList (user + agent messages, streaming indicator)
│   │   │       ├── StreamingMessage (renders text_delta chunks in real-time)
│   │   │       ├── ErrorBanner (LLM error with retry — shadcn AlertDialog)
│   │   │       ├── ToolCallIndicator (shows "Saving PRD..." during tool execution)
│   │   │       └── MessageComposer (shadcn Input/Button + image attachment)
│   │   ├── CommentsTab
│   │   │   ├── CommentThread[]
│   │   │   │   ├── CommentItem (avatar, body, timestamp, resolve — shadcn Button)
│   │   │   │   └── ReplyList → CommentItem[]
│   │   │   └── CommentComposer (shadcn Textarea/Button)
│   │   └── HistoryTab
│   │       └── VersionList (version, author, timestamp, change summary)
│   ├── /prd/new
│   │   ├── ProjectSelector (shadcn Select)
│   │   ├── DescriptionInput (shadcn Textarea)
│   │   └── → redirects to /prd/[id] ChatTab
│   ├── /admin/settings
│   │   ├── LlmSettings (provider, model, thinking level — shadcn Select/Input)
│   │   ├── WorkflowSettings (comment blocking toggle)
│   │   └── UserManagement (list, add, role assignment — shadcn Table)
│   └── /notifications
│       └── NotificationList (type, message, timestamp, link, read/unread)
└── Modals
    ├── SubmissionProgressModal (single-step GitHub PR — shadcn Dialog)
    ├── StatusTransitionConfirmModal (shadcn AlertDialog with required comment for rejection)
    └── ReviewerAssignmentDisplay (auto-assigned reviewers shown on transition)
```

### Backend Service Layer

```
API Routes (/api/*)
│
├── /api/auth/*           → NextAuth handlers
├── /api/projects/*       → ProjectService
├── /api/prds/*           → PrdService
├── /api/prds/[id]/versions/* → VersionService
├── /api/prds/[id]/comments/* → CommentService
├── /api/prds/[id]/status → StatusWorkflowService
├── /api/prds/[id]/submit → SubmissionPipelineService
├── /api/github/repos     → GitHubRepoService (user's repos via OAuth token)
├── /api/search/*         → SearchService (PostgreSQL FTS)
├── /api/notifications/*  → NotificationService
├── /api/admin/*          → AdminService
└── /api/health/*         → HealthCheckService

WebSocket Server (Socket.io + Redis adapter)
│
├── /agent namespace
│   ├── connect           → authenticate, join user room
│   ├── start_session     → AgentSessionManager.create()
│   ├── send_message      → session.prompt(), stream text_delta events
│   ├── resume_session    → AgentSessionManager.resume() (cold resume from EFS)
│   └── disconnect        → start idle timer (2h eviction)
│
└── /notifications namespace
    └── connect           → join user room, push real-time notifications

Server-Side Services
│
├── AgentSessionManager   → Manages per-user pi AgentSession lifecycle
│   ├── In-memory session map with 2h idle eviction timer
│   ├── Cold resume from EFS session files on reconnection
│   ├── Read-only codebase tools (read, grep, find, ls) scoped to repo clone
│   └── Dispose + cleanup on eviction or pod shutdown
├── RepoCloneService      → Manages per-user Git repo clones on EFS
│   ├── Clone using user's OAuth token on first agent session
│   ├── Periodic sync (git pull every 15 min)
│   ├── On-demand sync before agent session start
│   ├── Per-user paths: /efs/repos/<user-id>/<project-id>/
│   └── Cleanup on project deletion or user token revocation
├── GitHubRepoService     → Lists user's repos via GitHub REST API (OAuth token)
├── PrdService            → CRUD, versioning, PostgreSQL FTS vector update
├── ProjectService        → CRUD, member/reviewer management, githubRepo uniqueness
├── StatusWorkflowService → State machine, validation, auto-assignment
├── CommentService        → Threaded comments, resolve/unresolve
├── NotificationService   → DB persist + Socket.io push (best-effort)
├── SearchService         → PostgreSQL FTS query (ts_rank, plainto_tsquery)
├── SubmissionPipelineService → Single-step GitHub PR submission
│   └── GitService        → GitHub REST API (branch, commit, PR, labels, reviewers)
├── AdminService          → LLM settings, workflow settings, user management
└── AuditService          → Audit trail logging
```

---

## API Design

### REST API Endpoints

#### Authentication
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/signin` | Initiate OAuth sign-in |
| GET | `/api/auth/callback/:provider` | OAuth callback |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/signout` | Sign out |

#### GitHub
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/github/repos` | List user's accessible GitHub repos (grouped by owner) using OAuth token |

#### Projects
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List all projects (user has access to) |
| POST | `/api/projects` | Create project (`{ githubRepo, name?, description?, defaultLabels?, defaultReviewers? }`) — any authenticated user |
| GET | `/api/projects/:id` | Get project details |
| PUT | `/api/projects/:id` | Update project (owner or Admin) |
| DELETE | `/api/projects/:id` | Delete project (Admin) |
| GET | `/api/projects/:id/members` | List project members |
| POST | `/api/projects/:id/members` | Add member |
| DELETE | `/api/projects/:id/members/:userId` | Remove member |

#### PRDs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/prds` | List PRDs (filters: `?project=&status=&author=&tags=&from=&to=`) |
| POST | `/api/prds` | Create PRD (initiates agent session) |
| GET | `/api/prds/:id` | Get PRD details (current version content) |
| DELETE | `/api/prds/:id` | Delete PRD (Admin only) |
| PUT | `/api/prds/:id/tags` | Update tags |
| POST | `/api/prds/:id/co-authors` | Add co-author |
| DELETE | `/api/prds/:id/co-authors/:userId` | Remove co-author |

#### Search
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search?q=<query>&project=&status=&from=&to=` | Full-text search via PostgreSQL FTS with filters and ts_rank relevance ranking |

#### PRD Versions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/prds/:id/versions` | List all versions |
| GET | `/api/prds/:id/versions/:version` | Get specific version content |

#### PRD Status
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/prds/:id/status` | Transition status (`{ to: "IN_REVIEW" }`, `{ to: "DRAFT", comment: "..." }` for rejection) |
| GET | `/api/prds/:id/audit` | Get audit trail |

#### PRD Submission
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/prds/:id/submit` | Start submission pipeline |
| GET | `/api/prds/:id/submit/status` | Get submission step statuses |
| POST | `/api/prds/:id/submit/retry/:step` | Retry a failed step |

#### Comments
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/prds/:id/comments` | List comments (threaded) |
| POST | `/api/prds/:id/comments` | Create comment (`{ body, parentId? }`) |
| PUT | `/api/prds/:id/comments/:commentId/resolve` | Resolve/unresolve |

#### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List user's notifications (`?unread=true`) |
| PUT | `/api/notifications/:id/read` | Mark as read |
| PUT | `/api/notifications/read-all` | Mark all as read |

#### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/settings` | Get global settings (LLM config + workflow) |
| PUT | `/api/admin/settings` | Update global settings (LLM config + workflow) |
| GET | `/api/admin/users` | List users |
| POST | `/api/admin/users` | Add user |
| PUT | `/api/admin/users/:id/role` | Change user role |
| DELETE | `/api/admin/users/:id` | Remove user |

#### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Readiness probe (DB + Redis) |
| GET | `/livez` | Liveness probe (process alive) |

### WebSocket Events (Socket.io)

#### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `agent:start` | `{ prdId?, projectId, description?, mode: "create" \| "refine" }` | Start new agent session |
| `agent:message` | `{ sessionId, text, images? }` | Send message to agent |
| `agent:resume` | `{ sessionId }` | Resume existing session (cold resume from EFS) |

#### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `agent:text_delta` | `{ sessionId, delta, contentIndex }` | Streaming text chunk |
| `agent:message_start` | `{ sessionId }` | Agent response started |
| `agent:message_end` | `{ sessionId }` | Agent response complete |
| `agent:tool_start` | `{ sessionId, toolName }` | Agent calling a tool |
| `agent:tool_end` | `{ sessionId, toolName, success }` | Tool execution complete |
| `agent:prd_saved` | `{ prdId, version }` | PRD was saved by agent |
| `agent:error` | `{ sessionId, error, retryable }` | Agent error (with retry hint) |
| `notification` | `{ id, type, message, prdId }` | Real-time notification |

---

## Agent Integration

### AgentSessionManager

```typescript
import {
  AuthStorage, createAgentSession, createExtensionRuntime,
  createReadOnlyTools,
  ModelRegistry, type ResourceLoader, SessionManager, SettingsManager,
  type AgentSession, type AgentSessionEvent, type ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

interface ManagedSession {
  session: AgentSession;
  userId: string;
  idleTimer: NodeJS.Timeout;
  lastActivity: number;
}

class AgentSessionManager {
  private sessions: Map<string, ManagedSession> = new Map();

  async createSession(opts: {
    userId: string;
    mode: "create" | "refine";
    projectId: string;
    prdId?: string;
    prdContent?: string;
    description?: string;
  }): Promise<{ sessionId: string }> {

    const authStorage = AuthStorage.create(AUTH_JSON_PATH);
    const modelRegistry = new ModelRegistry(authStorage);
    const globalSettings = await getGlobalSettings();

    const model = getModel(globalSettings.llmProvider, globalSettings.llmModel);
    if (!model) throw new Error(`Model not found: ${globalSettings.llmProvider}/${globalSettings.llmModel}`);

    const skillName = opts.mode === "create" ? "create-prd" : "refine-prd";

    const resourceLoader: ResourceLoader = {
      getSkills: () => ({
        skills: [{
          name: skillName,
          description: skillName === "create-prd"
            ? "Create a comprehensive PRD from a product description"
            : "Refine an existing PRD with stakeholder feedback",
          filePath: SKILL_PATHS[skillName],
          baseDir: path.dirname(SKILL_PATHS[skillName]),
          source: "custom",
        }],
        diagnostics: [],
      }),
      getSystemPrompt: () => buildSystemPrompt(opts.mode, opts.prdContent),
      getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
      getPrompts: () => ({ prompts: [], diagnostics: [] }),
      getThemes: () => ({ themes: [], diagnostics: [] }),
      getAgentsFiles: () => ({ agentsFiles: [] }),
      getAppendSystemPrompt: () => [],
      getPathMetadata: () => new Map(),
      extendResources: () => {},
      reload: async () => {},
    };

    const sessionDir = path.join(EFS_SESSION_DIR, opts.userId);
    await fs.mkdir(sessionDir, { recursive: true });

    // Ensure per-user project repo clone is up to date before starting session
    const repoCloneDir = await repoCloneService.ensureSynced(opts.userId, opts.projectId);

    // Read-only codebase tools scoped to the project's repo clone
    // Agent can: read files, grep for patterns, find files, ls directories
    // Agent cannot: bash, edit, write — sandboxing maintained
    const codebaseTools = createReadOnlyTools(repoCloneDir);

    const { session } = await createAgentSession({
      model,
      thinkingLevel: globalSettings.llmThinkingLevel as any,
      authStorage,
      modelRegistry,
      resourceLoader,
      tools: codebaseTools,  // read, grep, find, ls — scoped to repo clone
      customTools: [
        createSavePrdTool(opts.userId, opts.projectId, opts.prdId),
        createListPrdsTool(opts.userId),
        createReadPrdTool(opts.userId),
      ],
      sessionManager: SessionManager.create(process.cwd(), sessionDir),
      settingsManager: SettingsManager.inMemory({
        compaction: { enabled: true },
        retry: { enabled: true, maxRetries: 3 },
      }),
    });

    const sessionId = session.sessionId;
    const managed: ManagedSession = {
      session,
      userId: opts.userId,
      lastActivity: Date.now(),
      idleTimer: this.startIdleTimer(sessionId),
    };
    this.sessions.set(sessionId, managed);

    return { sessionId };
  }

  /**
   * Cold resume: recreate an AgentSession from the EFS session file
   * when the in-memory session was evicted or the pod restarted.
   */
  async resumeSession(sessionFilePath: string, userId: string): Promise<{ sessionId: string }> {
    const authStorage = AuthStorage.create(AUTH_JSON_PATH);
    const modelRegistry = new ModelRegistry(authStorage);
    const globalSettings = await getGlobalSettings();
    const model = getModel(globalSettings.llmProvider, globalSettings.llmModel);
    if (!model) throw new Error("Model not found");

    const { session } = await createAgentSession({
      model,
      thinkingLevel: globalSettings.llmThinkingLevel as any,
      authStorage,
      modelRegistry,
      tools: [],
      customTools: [
        createSavePrdTool(userId, /* resolve from session */),
        createListPrdsTool(userId),
        createReadPrdTool(userId),
      ],
      sessionManager: SessionManager.open(sessionFilePath),
      settingsManager: SettingsManager.inMemory({
        compaction: { enabled: true },
        retry: { enabled: true, maxRetries: 3 },
      }),
    });

    const sessionId = session.sessionId;
    const managed: ManagedSession = {
      session,
      userId,
      lastActivity: Date.now(),
      idleTimer: this.startIdleTimer(sessionId),
    };
    this.sessions.set(sessionId, managed);

    return { sessionId };
  }

  async prompt(sessionId: string, text: string, images?: any[]): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (!managed) throw new Error("Session not found — may need cold resume");
    this.resetIdleTimer(sessionId);
    await managed.session.prompt(text, { images });
  }

  subscribe(sessionId: string, listener: (event: AgentSessionEvent) => void): () => void {
    const managed = this.sessions.get(sessionId);
    if (!managed) throw new Error("Session not found");
    return managed.session.subscribe(listener);
  }

  private startIdleTimer(sessionId: string): NodeJS.Timeout {
    return setTimeout(() => this.evictSession(sessionId), IDLE_TIMEOUT_MS);
  }

  private resetIdleTimer(sessionId: string): void {
    const managed = this.sessions.get(sessionId);
    if (managed) {
      clearTimeout(managed.idleTimer);
      managed.lastActivity = Date.now();
      managed.idleTimer = this.startIdleTimer(sessionId);
    }
  }

  private async evictSession(sessionId: string): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (managed) {
      managed.session.dispose();
      this.sessions.delete(sessionId);
      // EFS session file is preserved — cold resume possible
    }
  }

  /** Graceful shutdown: dispose all sessions */
  async disposeAll(): Promise<void> {
    for (const [id, managed] of this.sessions) {
      clearTimeout(managed.idleTimer);
      managed.session.dispose();
    }
    this.sessions.clear();
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}
```

### System Prompt

```typescript
function buildSystemPrompt(mode: "create" | "refine", prdContent?: string): string {
  const base = `You are a Product Requirements assistant helping Product Managers create and refine PRDs.

CAPABILITIES:
- You have READ-ONLY access to the project's codebase via read, grep, find, and ls tools
- Use these to understand the existing architecture, patterns, conventions, and technical context
- Use the save_prd tool to save PRD content when the document is ready
- Use the list_prds tool to find existing PRDs for cross-referencing
- Use the read_prd tool to read an existing PRD's content

CONSTRAINTS:
- You can ONLY help with PRD creation and refinement
- You can READ the codebase but CANNOT modify it — no edit, write, or bash commands
- If asked to do anything outside PRD work, politely decline and redirect to PRD-related tasks

RECOMMENDED APPROACH:
- Before writing requirements, explore the codebase to understand existing architecture
- Reference specific files, patterns, and conventions in the PRD where relevant
- Identify integration points with existing code

OUTPUT FORMAT:
- PRDs must be Markdown documents
- Include all standard sections: Product Summary, User Analysis, Goals & Non-Goals, Functional Requirements, Non-Functional Requirements, Acceptance Criteria
- Use clear, unambiguous language
- Make every requirement testable`;

  if (mode === "refine" && prdContent) {
    return `${base}

CURRENT PRD CONTENT:
---
${prdContent}
---

Your task is to refine this PRD based on stakeholder feedback. Review it first, then ask clarifying questions ONE AT A TIME. After incorporating all feedback, use save_prd to save the updated version.`;
  }

  return base;
}
```

### Custom Tools

```typescript
function createSavePrdTool(userId: string, projectId: string, existingPrdId?: string): ToolDefinition {
  return {
    name: "save_prd",
    label: "Save PRD",
    description: "Save the PRD document. Call this when the PRD is complete or after refinement.",
    parameters: Type.Object({
      title: Type.String({ description: "PRD title" }),
      content: Type.String({ description: "Full PRD Markdown content" }),
      changeSummary: Type.Optional(Type.String({ description: "Brief summary of changes (for refinements)" })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const result = await prdService.saveVersion({
        prdId: existingPrdId,
        projectId,
        authorId: userId,
        title: params.title,
        content: params.content,
        changeSummary: params.changeSummary,
      });
      // Update PostgreSQL FTS vector (async, non-blocking)
      searchService.updateSearchVector(result.prdId, params.title, params.content).catch(err =>
        logger.error({ err, prdId: result.prdId }, "Failed to update search vector")
      );
      return {
        content: [{ type: "text", text: `PRD saved successfully. ID: ${result.prdId}, Version: ${result.version}` }],
        details: { prdId: result.prdId, version: result.version },
      };
    },
  };
}

function createListPrdsTool(userId: string): ToolDefinition {
  return {
    name: "list_prds",
    label: "List PRDs",
    description: "List existing PRDs. Use this to find related PRDs for cross-referencing.",
    parameters: Type.Object({
      search: Type.Optional(Type.String({ description: "Search query" })),
      projectId: Type.Optional(Type.String({ description: "Filter by project" })),
    }),
    async execute(toolCallId, params) {
      const prds = await prdService.list({ userId, search: params.search, projectId: params.projectId });
      const summary = prds.map(p => `- ${p.title} (${p.status}, v${p.currentVersion})`).join("\n");
      return {
        content: [{ type: "text", text: summary || "No PRDs found." }],
        details: { count: prds.length },
      };
    },
  };
}

function createReadPrdTool(userId: string): ToolDefinition {
  return {
    name: "read_prd",
    label: "Read PRD",
    description: "Read the full content of an existing PRD by title or ID.",
    parameters: Type.Object({
      identifier: Type.String({ description: "PRD title or ID" }),
    }),
    async execute(toolCallId, params) {
      const prd = await prdService.findByIdentifier(params.identifier, userId);
      if (!prd) {
        return { content: [{ type: "text", text: `PRD not found: ${params.identifier}` }], details: {}, isError: true };
      }
      return {
        content: [{ type: "text", text: prd.content }],
        details: { prdId: prd.id, version: prd.currentVersion },
      };
    },
  };
}
```

---

## Submission Pipeline

### Pipeline Orchestrator (GitHub-Only)

```typescript
interface SubmissionResult {
  status: "success" | "failed";
  prUrl?: string;
  prNumber?: number;
  branch?: string;
  error?: string;
}

class SubmissionPipelineService {
  /**
   * Single-step submission: create or update a GitHub PR.
   * Uses the submitting user's OAuth token from the Account table.
   */
  async execute(prdId: string, userId: string): Promise<SubmissionResult> {
    const prd = await prdService.getWithCurrentVersion(prdId);
    const project = await projectService.get(prd.projectId);
    const oauthToken = await this.getUserGitHubToken(userId);

    if (!oauthToken) {
      return { status: "failed", error: "GitHub token not found. Please re-authenticate." };
    }

    const isResubmission = !!prd.githubPrNumber;
    const branchName = prd.githubBranch || `prd/${prd.id}-${slugify(prd.title)}`;
    const filePath = `docs/PRD/${slugify(prd.title)}-prd.md`;

    try {
      let result: { prUrl: string; prNumber: number };

      if (isResubmission) {
        // Push new commit to existing branch — updates the existing PR
        result = await gitService.updatePr({
          repo: project.githubRepo,
          branch: branchName,
          filePath,
          content: prd.content,
          commitMessage: `Update PRD: ${prd.title} (v${prd.currentVersion})`,
          token: oauthToken,
          prNumber: prd.githubPrNumber!,
        });
      } else {
        // Create new branch, commit file, open PR with labels and reviewers
        result = await gitService.createPr({
          repo: project.githubRepo,
          branch: branchName,
          filePath,
          content: prd.content,
          title: `PRD: ${prd.title}`,
          description: `Automated PRD submission (v${prd.currentVersion})`,
          token: oauthToken,
          labels: project.defaultLabels,
          reviewers: project.defaultReviewers,
        });
      }

      // Store artifact links
      await prdService.updateGitHubArtifacts(prdId, {
        githubPrUrl: result.prUrl,
        githubPrNumber: result.prNumber,
        githubBranch: branchName,
      });

      await statusWorkflowService.transition(prdId, userId, "SUBMITTED");

      return {
        status: "success",
        prUrl: result.prUrl,
        prNumber: result.prNumber,
        branch: branchName,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Detect access revocation
      if (message.includes("403") || message.includes("404")) {
        return { status: "failed", error: `Repository access denied. You may have lost access to ${project.githubRepo}. Please check your GitHub permissions.` };
      }

      return { status: "failed", error: message };
    }
  }

  /**
   * Retrieve the user's GitHub OAuth access token from the NextAuth Account table.
   */
  private async getUserGitHubToken(userId: string): Promise<string | null> {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "github" },
      select: { access_token: true },
    });
    return account?.access_token ?? null;
  }
}
```

### RepoCloneService (Per-User Clones)

```typescript
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";

const execAsync = promisify(exec);

class RepoCloneService {
  private syncTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Clone a project's repo to EFS for a specific user.
   * Uses the user's GitHub OAuth token for authentication.
   * Path: /efs/repos/<userId>/<projectId>/
   */
  async cloneRepo(userId: string, projectId: string, githubRepo: string): Promise<void> {
    const oauthToken = await this.getUserGitHubToken(userId);
    if (!oauthToken) throw new Error("GitHub token not found. Please re-authenticate.");

    const cloneDir = path.join(EFS_REPOS_DIR, userId, projectId);
    const authedUrl = `https://oauth2:${oauthToken}@github.com/${githubRepo}.git`;

    await fs.mkdir(cloneDir, { recursive: true });
    await execAsync(`git clone --depth 1 ${authedUrl} ${cloneDir}`);

    const timerKey = `${userId}:${projectId}`;
    this.startPeriodicSync(timerKey, cloneDir, userId);
  }

  /**
   * Ensure the repo clone is up to date for a specific user.
   * Called before each agent session start.
   */
  async ensureSynced(userId: string, projectId: string): Promise<string> {
    const cloneDir = path.join(EFS_REPOS_DIR, userId, projectId);
    const exists = await fs.access(path.join(cloneDir, ".git")).then(() => true).catch(() => false);

    if (!exists) {
      const project = await projectService.get(projectId);
      if (!project.githubRepo) throw new Error("Project has no GitHub repo configured");
      await this.cloneRepo(userId, projectId, project.githubRepo);
      return cloneDir;
    }

    // Refresh token in case it was updated
    const oauthToken = await this.getUserGitHubToken(userId);
    if (oauthToken) {
      try {
        // Update remote URL with current token
        await execAsync(
          `git remote set-url origin https://oauth2:${oauthToken}@github.com/$(git remote get-url origin | sed 's|.*github.com/||')`,
          { cwd: cloneDir, timeout: 10_000 }
        );
        await execAsync("git pull --ff-only", { cwd: cloneDir, timeout: 30_000 });
      } catch (err) {
        logger.warn({ err, userId, projectId }, "Git pull failed; agent will use existing clone");
      }
    }

    return cloneDir;
  }

  private startPeriodicSync(timerKey: string, cloneDir: string, userId: string): void {
    const existing = this.syncTimers.get(timerKey);
    if (existing) clearInterval(existing);

    const timer = setInterval(async () => {
      try {
        const token = await this.getUserGitHubToken(userId);
        if (!token) return; // Token revoked; stop syncing
        await execAsync("git pull --ff-only", { cwd: cloneDir, timeout: 30_000 });
      } catch (err) {
        logger.warn({ err, timerKey }, "Periodic git sync failed");
      }
    }, this.SYNC_INTERVAL_MS);

    this.syncTimers.set(timerKey, timer);
  }

  async removeClone(userId: string, projectId: string): Promise<void> {
    const timerKey = `${userId}:${projectId}`;
    const timer = this.syncTimers.get(timerKey);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(timerKey);
    }
    const cloneDir = path.join(EFS_REPOS_DIR, userId, projectId);
    await fs.rm(cloneDir, { recursive: true, force: true });
  }

  private async getUserGitHubToken(userId: string): Promise<string | null> {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "github" },
      select: { access_token: true },
    });
    return account?.access_token ?? null;
  }
}
```

### GitHub Repo Service

```typescript
interface GitHubRepo {
  fullName: string;   // "owner/repo"
  name: string;       // "repo"
  owner: string;      // "owner"
  ownerType: "User" | "Organization";
  description: string | null;
  private: boolean;
  defaultBranch: string;
}

class GitHubRepoService {
  /**
   * List all repositories accessible to the user via their OAuth token.
   * Groups results by owner (user account + organizations).
   */
  async listUserRepos(userId: string): Promise<Map<string, GitHubRepo[]>> {
    const token = await this.getUserGitHubToken(userId);
    if (!token) throw new Error("GitHub token not found. Please re-authenticate.");

    const repos: GitHubRepo[] = [];
    let page = 1;

    // Paginate through all accessible repos
    while (true) {
      const response = await fetch(
        `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" } }
      );

      if (!response.ok) {
        if (response.status === 401) throw new Error("GitHub token expired. Please re-authenticate.");
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.length === 0) break;

      repos.push(...data.map((r: any) => ({
        fullName: r.full_name,
        name: r.name,
        owner: r.owner.login,
        ownerType: r.owner.type,
        description: r.description,
        private: r.private,
        defaultBranch: r.default_branch,
      })));

      page++;
    }

    // Group by owner
    const grouped = new Map<string, GitHubRepo[]>();
    for (const repo of repos) {
      const existing = grouped.get(repo.owner) || [];
      existing.push(repo);
      grouped.set(repo.owner, existing);
    }

    return grouped;
  }

  private async getUserGitHubToken(userId: string): Promise<string | null> {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "github" },
      select: { access_token: true },
    });
    return account?.access_token ?? null;
  }
}

---

## Error Handling & Recovery

### Agent Conversation Errors

| Scenario | Behavior | User Experience |
|----------|----------|----------------|
| LLM API rate limit / 503 / timeout | Pi SDK auto-retries (3 attempts with backoff) | User sees "Thinking..." during retries; transparent |
| LLM retries exhausted | Agent emits error event via WebSocket | Chat UI shows error banner: "Something went wrong. [Retry]" button re-sends last message |
| LLM returns malformed response | Pi SDK handles internally; may retry | Transparent to user |
| `save_prd` tool fails (DB error) | Tool returns `isError: true`; agent sees error and informs user | Agent says "I couldn't save the PRD. Please try again." |
| WebSocket disconnects mid-stream | Socket.io auto-reconnects (default: 5 attempts with backoff) | Chat shows "Reconnecting..." indicator; on reconnect, fetches latest messages from session |
| WebSocket reconnects to different pod | Session not in memory on new pod | Client sends `agent:resume` → cold resume from EFS → conversation intact |
| Pod restarts | All in-memory sessions lost | On next user visit, cold resume from EFS; conversation intact, <5s resume time |

### Submission Pipeline Errors (GitHub PR)

| Scenario | Behavior | User Experience |
|----------|----------|----------------|
| GitHub API auth error (401) | OAuth token expired or revoked | Error: "GitHub token expired. Please re-authenticate." with sign-in button |
| GitHub API forbidden (403) | User lost access to repo | Error: "Repository access denied. Check your GitHub permissions." |
| GitHub API not found (404) | Repo deleted or user removed | Error: "Repository not found. It may have been deleted or you may have lost access." |
| Branch conflict | Branch already exists from a different source | Create branch with unique suffix (e.g., `prd/<id>-<slug>-v2`) |
| PR creation fails | Network or API error | "Retry" button appears; submission can be retried |
| Re-submission (push to existing branch) | New commit pushed to existing PR branch | PR updated; PR conversation history preserved |
| Re-submission with merge conflicts | Existing branch has conflicts with default branch | Error shown; user advised to resolve conflicts in GitHub |

### Database & Infrastructure Errors

| Scenario | Behavior |
|----------|----------|
| PostgreSQL unreachable | `/healthz` returns 503; ALB routes traffic away; OTel alert fires |
| Redis unreachable | Socket.io falls back to single-pod mode (no cross-pod messaging); degraded but functional |
| EFS unreachable | Agent session create/resume fails; error shown to user; existing API routes unaffected |
| Git repo clone/sync fails | Agent session starts without codebase access (degraded); warning shown in chat: "Codebase not available — PRD creation will proceed without code context" |
| GitHub API unreachable | Repo listing fails; submission fails; error shown to user with retry option |
| User's GitHub token expired | API calls return 401; user prompted to re-authenticate via GitHub OAuth |

---

## Sprint Planning

### Sprint 1: Foundation (Weeks 1–2) — 9 tasks

**Goal:** Deployable skeleton with auth, database, and observability foundation.

| Task | Estimate | Priority |
|------|----------|----------|
| TASK-001: Next.js project scaffold | 2h | P0 |
| TASK-002: Database schema design | 4h | P0 |
| TASK-003: Prisma ORM setup + migrations | 3h | P0 |
| TASK-004: OAuth/SSO auth (NextAuth) | 6h | P0 |
| TASK-005: RBAC middleware | 4h | P0 |
| TASK-006: API route structure + validation | 4h | P0 |
| TASK-007: OpenTelemetry SDK setup | 4h | P1 |
| TASK-008: Dockerfile (multi-stage) | 2h | P1 |
| TASK-009: Dev environment (docker-compose with PG, Redis, OpenSearch) | 3h | P0 |

**Total:** ~32h

### Sprint 2: Core Agent Integration (Weeks 3–4) — 9 tasks

**Goal:** Working chat interface that creates PRDs via pi agent.

| Task | Estimate | Priority |
|------|----------|----------|
| TASK-010: AgentSessionManager (with 2h idle eviction + cold resume) | 10h | P0 |
| TASK-011: Custom ResourceLoader | 4h | P0 |
| TASK-012: Custom tools (save/list/read) + read-only codebase tools | 8h | P0 |
| TASK-012a: RepoCloneService (clone, sync, cleanup on EFS) | 6h | P0 |
| TASK-013: WebSocket server (Socket.io + Redis adapter + sticky sessions) | 8h | P0 |
| TASK-014: Session persistence (EFS mount + cold resume logic) | 6h | P0 |
| TASK-015: Chat UI (messages, streaming, error banner + retry, image attach) | 14h | P0 |
| TASK-016: "New PRD" flow | 6h | P0 |
| TASK-017: "Refine PRD" flow | 4h | P0 |
| TASK-018: Session resume (reconnect to EFS session after browser close) | 4h | P1 |

**Total:** ~62h

### Sprint 3: PRD & Project Management (Weeks 5–6) — 8 tasks

**Goal:** Full document management UI with OpenSearch-powered search.

| Task | Estimate | Priority |
|------|----------|----------|
| TASK-019: Projects UI (list, create, edit) | 8h | P0 |
| TASK-020: Projects API (CRUD) | 4h | P0 |
| TASK-021: PRD Dashboard (list view) | 8h | P0 |
| TASK-022: OpenSearch setup + index sync + search API | 10h | P0 |
| TASK-023: PRD Detail View (Markdown render + TOC) | 6h | P0 |
| TASK-024: Version history API + UI | 4h | P0 |
| TASK-025: Tags/labels API + UI | 3h | P1 |
| TASK-026: PRD ownership model | 3h | P1 |

**Total:** ~46h

### Sprint 4: Workflow & Collaboration (Weeks 7–8) — 9 tasks

**Goal:** Complete status workflow with comments and notifications.

| Task | Estimate | Priority |
|------|----------|----------|
| TASK-027: Status state machine (with re-open path) | 6h | P0 |
| TASK-028: Reviewer auto-assignment | 3h | P0 |
| TASK-029: Comments API | 6h | P0 |
| TASK-030: Comments UI | 8h | P0 |
| TASK-031: Unresolved comments block approval | 2h | P1 |
| TASK-032: Notifications (DB + Socket.io best-effort push) | 8h | P0 |
| TASK-033: Notifications UI | 6h | P0 |
| TASK-034: Audit trail logging | 3h | P1 |
| TASK-035: Status workflow UI | 6h | P0 |

**Total:** ~48h

### Sprint 5: Submission Pipeline (Weeks 9–10) — 9 tasks

**Goal:** One-click submission to Confluence, Jira, Git, and Beads.

| Task | Estimate | Priority |
|------|----------|----------|
| TASK-036: Confluence service (markdown-it converter + create/update page) | 10h | P0 |
| TASK-037: Jira service (create/update Epic with AC) | 8h | P0 |
| TASK-038: Git service (branch `prd/<id>-<slug>`, file `docs/PRD/`, stacked PRs) | 10h | P0 |
| TASK-039: Beads service | 4h | P0 |
| TASK-040: Pipeline orchestrator (sequential + partial failure + retry) | 8h | P0 |
| TASK-041: Pipeline progress UI (stepper + retry buttons) | 6h | P0 |
| TASK-042: Global + per-project settings storage/resolution | 4h | P0 |
| TASK-043: Admin integration settings UI | 4h | P0 |
| TASK-044: Artifact link storage + re-submission logic | 4h | P0 |

**Total:** ~58h

### Sprint 6: Admin, Observability & Deployment (Weeks 11–12) — 12 tasks

**Goal:** Production-ready deployment with full observability.

| Task | Estimate | Priority |
|------|----------|----------|
| TASK-045: Admin settings page | 6h | P0 |
| TASK-046: LLM admin configuration | 3h | P0 |
| TASK-047: OTel trace instrumentation (API, DB, LLM, external, agent lifecycle) | 8h | P0 |
| TASK-048: Custom OTel metrics (prd_count_by_status, session_active, evictions, pipeline) | 4h | P0 |
| TASK-049: Structured logging (pino + OTel bridge + trace IDs) | 3h | P0 |
| TASK-050: Helm chart (deployment, service, ingress w/ sticky sessions, HPA, EFS PVC, secrets) | 10h | P0 |
| TASK-051: CI/CD pipeline (GitHub Actions) | 6h | P0 |
| TASK-052: Health checks (/healthz: DB + Redis + OpenSearch, /livez) | 3h | P0 |
| TASK-053: HPA configuration (2–5 replicas) | 2h | P1 |
| TASK-054: OTel Collector deployment | 4h | P1 |
| TASK-055: GlobalSettings seed script | 1h | P0 |
| TASK-056: E2E integration testing (full flow) | 14h | P0 |

**Total:** ~64h

### Sprint 7: GitHub-Centric Auth, Projects & Submission (Weeks 13–15) — 17 tasks

**Goal:** Replace Google OAuth with GitHub; simplify projects to GitHub-only; single-step PR submission.

| Task | Estimate | Priority |
|------|----------|----------|
| TASK-057: GitHub OAuth provider switch | 6h | P0 |
| TASK-058: Login page update | 2h | P0 |
| TASK-059: GitHub repo listing API | 6h | P0 |
| TASK-060: RepoPicker component | 8h | P0 |
| TASK-061: Simplify Project model (migration) | 4h | P0 |
| TASK-062: Update Project API | 4h | P0 |
| TASK-063: Refactor ProjectForm | 6h | P0 |
| TASK-064: Simplify PRD model (migration) | 3h | P0 |
| TASK-065: Simplify GlobalSettings (migration) | 2h | P0 |
| TASK-066: Single-step GitHub submission | 10h | P0 |
| TASK-067: Update SubmissionModal | 4h | P0 |
| TASK-068: Per-user RepoCloneService | 6h | P0 |
| TASK-069: Repo access revocation handling | 3h | P1 |
| TASK-070: OAuth token expiration handling | 4h | P1 |
| TASK-071: Delete dead integration code | 4h | P0 |
| TASK-072: Update admin settings page | 3h | P0 |
| TASK-073: Update all affected tests | 8h | P0 |

**Total:** ~83h

### Sprint 8: Search Simplification (Week 16) — 5 tasks

**Goal:** Replace OpenSearch with PostgreSQL FTS; remove OpenSearch infrastructure.

| Task | Estimate | Priority |
|------|----------|----------|
| TASK-074: PostgreSQL FTS (tsvector + GIN index) | 6h | P0 |
| TASK-075: Update search API | 4h | P0 |
| TASK-076: Remove OpenSearch infrastructure | 4h | P0 |
| TASK-077: FTS index sync on PRD save | 3h | P0 |
| TASK-078: Update search tests | 3h | P0 |

**Total:** ~20h

### Sprint 9: shadcn/ui Component Library (Weeks 17–18) — 11 tasks

**Goal:** Adopt shadcn/ui; migrate all components to use shared primitives; CSS variable theming.

| Task | Estimate | Priority |
|------|----------|----------|
| TASK-079: Initialize shadcn/ui | 3h | P0 |
| TASK-080: Install core components | 4h | P0 |
| TASK-081: Replace inline SVGs with lucide-react | 6h | P0 |
| TASK-082: Migrate form components | 8h | P0 |
| TASK-083: Migrate dialog components | 6h | P0 |
| TASK-084: Migrate badge components | 4h | P0 |
| TASK-085: Migrate navigation components | 6h | P0 |
| TASK-086: Migrate data display components | 6h | P0 |
| TASK-087: CSS variable theming | 4h | P0 |
| TASK-088: Verify all tests pass | 6h | P0 |
| TASK-089: Accessibility audit | 4h | P0 |

**Total:** ~57h

### Sprint Summary

| Sprint | Weeks | Tasks | Estimate | Theme |
|--------|-------|-------|----------|-------|
| 1 | 1–2 | 9 | 32h | Foundation |
| 2 | 3–4 | 10 | 70h | Agent Integration |
| 3 | 5–6 | 8 | 46h | PRD & Project Management |
| 4 | 7–8 | 9 | 48h | Workflow & Collaboration |
| 5 | 9–10 | 9 | 58h | Submission Pipeline |
| 6 | 11–12 | 12 | 64h | Admin, Observability & Deployment |
| 7 | 13–15 | 17 | 83h | GitHub-Centric Auth, Projects & Submission |
| 8 | 16 | 5 | 20h | Search Simplification |
| 9 | 17–18 | 11 | 57h | shadcn/ui Component Library |
| **Total** | **18 weeks** | **90** | **~478h** | |

**Team:** 2 developers × 18 weeks × ~35h/week productive = ~1260h capacity. **478h estimated work = ~38% utilization**, leaving significant buffer for unknowns, code review, testing, and LLM API integration debugging.

---

## Testing Strategy

### Unit Tests (≥80% coverage)

| Component | Test Focus | Framework |
|-----------|-----------|-----------|
| Status workflow state machine | Valid/invalid transitions, guard conditions, re-open path | Jest |
| API route handlers | Request validation, response format, auth checks, RBAC | Jest + supertest |
| GitHub submission service | PR creation, re-submission (commit to existing branch), error handling, token retrieval | Jest (mocked GitHub API) |
| GitHub repo listing service | Pagination, grouping by owner, token expiration handling | Jest (mocked GitHub API) |
| Custom agent tools | Input validation, database interaction, response format, FTS vector update | Jest (mocked Prisma) |
| PostgreSQL FTS queries | tsvector generation, ts_rank ordering, edge cases (empty query, special chars) | Jest + test database |
| Comment threading logic | Nesting, resolve/unresolve, blocking approval, edge cases | Jest |
| Notification triggers | Correct notification type/recipient for each event | Jest |
| Agent session idle eviction | Timer reset on activity, eviction after 2h, dispose cleanup | Jest (fake timers) |
| RepoCloneService | Per-user clone, sync, cleanup, token refresh, failure handling, periodic timer | Jest (mocked git CLI) |
| Read-only tool scoping | Tools resolve paths within repo clone dir; reject path traversal | Jest |
| RepoPicker component | Renders repos grouped by owner, search filtering, auto-name population | Jest + RTL |
| shadcn/ui component integration | Button variants, Dialog focus trapping, Badge color mapping | Jest + RTL |

### Integration Tests (≥70% coverage)

| Scenario | Test Focus | Framework |
|----------|-----------|-----------|
| Auth flow | GitHub OAuth redirect → callback → session creation → token storage in Account → role check | Jest + NextAuth test utils |
| PRD lifecycle | Create → refine → review → approve → submit | Jest + test database |
| Agent session | SDK session creation → prompt → tool execution → save (mock model returning scripted tool calls) | Jest + pi SDK (mock model) |
| Agent cold resume | Create session → evict → resume from EFS → verify conversation intact | Jest + temp EFS directory |
| Agent codebase access | Create session with repo clone → agent reads file → agent greps for pattern → verify results | Jest + temp git repo + pi SDK (mock model) |
| WebSocket streaming | Connect → send message → receive text_delta events → disconnect → reconnect | Jest + Socket.io client |
| GitHub submission | Mock GitHub API → create PR → verify artifact links → re-submit → verify commit pushed to existing branch | Jest + nock |
| GitHub repo listing | Mock GitHub API → list repos → verify grouping by owner → handle pagination | Jest + nock |
| PostgreSQL FTS | Save PRD version → verify tsvector updated → search → verify ranked results | Jest + test database |
| Database migrations | Up/down migration for all schema changes | Prisma migrate |

### Agent Mock Model

```typescript
/**
 * Creates a fake model that returns pre-scripted responses for testing.
 * The pi SDK's createAgentSession() accepts any Model object.
 */
function createMockModel(responses: Array<{
  text?: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, any> }>;
}>): Model {
  let callIndex = 0;
  return {
    id: "mock-model",
    name: "Mock Model",
    provider: "mock",
    api: "mock",
    reasoning: false,
    input: ["text"],
    contextWindow: 200000,
    maxTokens: 16384,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    // The SDK calls the model's generate function;
    // this mock returns pre-scripted responses
    async *generate() {
      const response = responses[callIndex++ % responses.length];
      if (response.text) {
        yield { type: "text_delta", delta: response.text };
      }
      if (response.toolCalls) {
        for (const tc of response.toolCalls) {
          yield { type: "toolcall_start", name: tc.name };
          yield { type: "toolcall_end", name: tc.name, arguments: tc.arguments };
        }
      }
      yield { type: "done", reason: response.toolCalls ? "toolUse" : "stop" };
    },
  };
}
```

### E2E Tests

| Scenario | Steps | Framework |
|----------|-------|-----------|
| Full PRD creation flow | Login → select project → new PRD → chat → save → verify in dashboard | Playwright |
| PRD review & approval | Create PRD → submit for review → reviewer approves → verify status | Playwright |
| Submission pipeline | Approved PRD → submit → verify progress UI → verify artifact links | Playwright (mocked external APIs) |
| Concurrent sessions | Two browser sessions → simultaneous PRD creation → no cross-contamination | Playwright |
| Error recovery | Chat → simulate LLM error → verify error banner → retry → verify recovery | Playwright |

### Performance Tests

| Metric | Target | Tool |
|--------|--------|------|
| 10 concurrent WebSocket connections streaming | No message loss, <100ms inter-message delay | k6 WebSocket |
| PRD list API with 500 PRDs | p95 < 200ms | k6 HTTP |
| PostgreSQL FTS with 500 PRDs | p95 < 300ms | k6 HTTP |
| GitHub PR submission (mocked API) | < 5s total | k6 HTTP |

---

## Quality Requirements

### Security

| Requirement | Implementation |
|-------------|---------------|
| Authentication on all endpoints | NextAuth middleware; reject 401 for unauthenticated requests |
| RBAC enforcement | Role-checking middleware on every API route |
| Agent sandboxing | Read-only codebase tools (`read`, `grep`, `find`, `ls`) scoped to project repo clone directory; no `bash`, `edit`, `write`; custom PRD tools (`save_prd`, `list_prds`, `read_prd`); tool-level enforcement is the security boundary |
| Secrets management | LLM API keys in Kubernetes Secrets; GitHub OAuth tokens stored in Account table by NextAuth (encrypted at rest via AWS RDS encryption); never in frontend bundle or API responses |
| OAuth token security | GitHub access tokens stored only in Account table; never exposed to frontend; used server-side only for GitHub API calls |
| CSRF protection | NextAuth built-in CSRF tokens |
| Input validation | Zod schemas on all API inputs |
| SQL injection prevention | Prisma parameterized queries (ORM) |
| XSS prevention | React's built-in escaping; sanitize Markdown rendering via DOMPurify |
| WebSocket auth | Socket.io `auth` middleware validates JWT on connection; reject unauthorized connections |

### Accessibility (WCAG 2.1 AA)

| Requirement | Implementation |
|-------------|---------------|
| Keyboard navigation | All interactive elements focusable and operable via keyboard |
| Screen reader support | ARIA labels on buttons, forms, status badges, notifications |
| Color contrast | 4.5:1 minimum contrast ratio; status badges not color-only (include text) |
| Focus management | Chat messages announce via aria-live region; modals trap focus |
| Automated scanning | axe-core integration in CI; zero violations on core flows |

### Performance

| Metric | Target |
|--------|--------|
| First Contentful Paint (FCP) | < 1.5s |
| Largest Contentful Paint (LCP) | < 2.5s |
| Time to Interactive (TTI) | < 3.5s |
| API response time (non-LLM, p95) | < 500ms |
| WebSocket time-to-first-token | < 3s (LLM dependent) |
| Agent session cold resume | < 5s |

### Observability

| Signal | Implementation |
|--------|---------------|
| **Traces** | `@opentelemetry/sdk-node` auto-instrumentation for HTTP/Prisma; manual spans for agent sessions, tool execution, GitHub submission, search queries |
| **Metrics** | `@opentelemetry/sdk-metrics`; custom gauges: `prd_count_by_status{status}`, `agent_session_active`; custom counters: `agent_session_idle_evictions_total`, `submission_step_result{step,status}`; custom histogram: `submission_pipeline_duration_seconds` |
| **Logs** | `pino` with OTel log bridge; `trace_id` + `span_id` in every log entry; JSON format; structured context (userId, prdId, action) |
| **Export** | OTel Collector sidecar → CloudWatch (logs), X-Ray (traces), Prometheus (metrics) |
| **Alerts** | CloudWatch Alarms: 5xx rate > 1%, agent_session error rate > 5%, submission failure rate > 10%, GitHub API error rate > 5% |

---

## Acceptance Criteria

### Technical Acceptance Criteria

- [ ] **TAC-1:** `createAgentSession()` creates a session with only `create-prd` and `refine-prd` skills loaded; no built-in tools (bash, read, edit, write) available
- [ ] **TAC-2:** Custom tools (`save_prd`, `list_prds`, `read_prd`) execute correctly and persist data to PostgreSQL; `save_prd` also updates the FTS search vector
- [ ] **TAC-3:** WebSocket streams `text_delta` events from the pi SDK to the browser with <100ms relay latency
- [ ] **TAC-4:** Agent session files are stored on EFS and accessible from any backend pod; cold resume restores full conversation in <5s
- [ ] **TAC-5:** Idle agent sessions are evicted after 2 hours; `agent_session_idle_evictions_total` metric increments
- [ ] **TAC-6:** ALB sticky sessions route a user's WebSocket to the same pod consistently (verified via cookie inspection)
- [ ] **TAC-7:** Status state machine rejects invalid transitions (e.g., Draft → Submitted) with a 400 error; allows re-open (Submitted → Draft)
- [ ] **TAC-8:** Submission creates a GitHub PR with correct content, labels, and reviewers using the user's OAuth token
- [ ] **TAC-9:** Re-submission pushes a new commit to the existing PR branch (does not create a new PR); PR conversation history preserved
- [ ] **TAC-10:** Project creation enforces unique `githubRepo` constraint; cannot link the same repo to two projects
- [ ] **TAC-11:** PostgreSQL FTS returns relevant results for queries; tsvector column is updated on PRD version save
- [ ] **TAC-12:** Search results are ranked by relevance using ts_rank; title matches ranked higher than content matches
- [ ] **TAC-13:** OTel traces span the full request lifecycle including database, LLM, external API calls, and agent session lifecycle
- [ ] **TAC-14:** Custom metric `prd_count_by_status` accurately reflects current PRD counts across all four statuses
- [ ] **TAC-15:** Helm chart deploys successfully to EKS with configurable replicas, secrets, EFS PVC, and sticky session ingress
- [ ] **TAC-16:** HPA scales pods from 2 to 5 replicas under load (10 concurrent sessions)
- [ ] **TAC-17:** Unit test coverage ≥ 80%; integration test coverage ≥ 70%
- [ ] **TAC-18:** All Playwright E2E tests pass on Chrome and Firefox
- [ ] **TAC-19:** axe-core accessibility scan reports zero violations on dashboard, PRD detail, and chat views
- [ ] **TAC-20:** Chat UI displays error banner with retry button when LLM retries are exhausted; retry re-sends the last message successfully
- [ ] **TAC-21:** `GlobalSettings` row is seeded on first deploy; admin can update LLM and workflow settings from the settings page
- [ ] **TAC-22:** Agent integration tests use mock model with scripted responses; no real LLM API calls in CI
- [ ] **TAC-23:** Agent session has read-only access (`read`, `grep`, `find`, `ls`) to the project's Git repo clone on EFS; can read source files, search for patterns, and list directories
- [ ] **TAC-24:** Agent cannot execute `bash`, `edit`, or `write` — attempting to call these tools returns an error (tools not registered)
- [ ] **TAC-25:** RepoCloneService clones project repo to EFS using user's OAuth token; per-user paths at `/efs/repos/<user-id>/<project-id>/`; `git pull` syncs every 15 minutes; on-demand sync occurs before each agent session start
- [ ] **TAC-26:** If Git repo clone fails, agent session starts in degraded mode (no codebase access) with a warning displayed in chat; custom PRD tools still function
- [ ] **TAC-27:** GitHub OAuth login works end-to-end; OAuth token stored in Account table with `repo`, `read:user`, `user:email` scopes
- [ ] **TAC-28:** RepoPicker lists user's GitHub repos grouped by owner; selecting a repo auto-fills project name; search filters repos in real-time
- [ ] **TAC-29:** Expired or revoked GitHub tokens are detected; user is prompted to re-authenticate; clear error messages shown
- [ ] **TAC-30:** ConfluenceService, JiraService, BeadsService, and integration-config-service are fully removed; no dead code remains
- [ ] **TAC-31:** shadcn/ui initialized with `components.json` and CSS variables; all 13+ components installed in `src/components/ui/`
- [ ] **TAC-32:** All feature components refactored to use shadcn/ui primitives; no raw `<button className="bg-blue-600...">` patterns outside `src/components/ui/`
- [ ] **TAC-33:** All inline SVG icons replaced with `lucide-react` components
- [ ] **TAC-34:** CSS variable theming configured; changing `--primary` in devtools updates all primary-colored elements

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-26 | TRD Generator | Initial TRD — Full technical design for PRD Web Agent |
| 2.0 | 2026-02-26 | TRD Generator (Refined) | Stakeholder interview refinements: (1) ALB sticky sessions with cookie affinity for pod routing; (2) 2-hour idle eviction for agent sessions with cold resume from EFS; (3) Library-based Markdown→Confluence conversion via markdown-it with custom renderer; (4) Git branch `prd/<id>-<slug>`, file `docs/PRD/<title>-prd.md`, stacked PRs on re-submission; (5) Transparent LLM error display with retry button in chat UI; (6) AWS OpenSearch for full-text search (replacing PostgreSQL FTS) with index sync and reconciliation; (7) Tool-level sandboxing only — no prompt input filtering; (8) Mock model approach for agent integration tests; (9) Notifications: DB source of truth + Socket.io best-effort push; (10) Infrastructure sizing for 10 PMs / 10 PRDs per month / ~$300-450/month AWS cost; (11) Added Error Handling & Recovery section; (12) Added Infrastructure Sizing section; (13) Added OpenSearch index schema and sync strategy; (14) Added agent mock model for testing; (15) Added GlobalSettings seed task; (16) Updated task count to 56, estimate to ~310h; (17) Added 7 new technical acceptance criteria (TAC-5 through TAC-12, TAC-20 through TAC-22) |
| 3.0 | 2026-02-26 | TRD Generator (Refined) | Codebase access for agent sessions: (1) Added RepoCloneService — clones project Git repos to EFS at `/efs/repos/<project-id>/`, periodic sync every 15 min, on-demand sync before session start; (2) Agent sessions now include pi SDK `createReadOnlyTools(repoCloneDir)` providing `read`, `grep`, `find`, `ls` scoped to the project's repo clone — agent can explore existing codebase for architecture context; (3) No `bash`, `edit`, `write` — read-only sandboxing maintained; (4) Full repo access (no path filtering) — sensitive files should not be in repos; (5) S3 rejected for repo storage (pi tools require POSIX filesystem); (6) Graceful degradation: if clone/sync fails, agent starts without codebase access with warning; (7) Updated system prompt to instruct agent to explore codebase before writing requirements; (8) Added AD-14 through AD-16 architecture decisions; (9) Added TAC-23 through TAC-26 acceptance criteria; (10) Added RepoCloneService unit + integration tests; (11) Updated task count to 57, estimate to ~318h; (12) Updated EFS sizing for repo clones (~10-20 GB) |
| 4.0 | 2026-02-27 | TRD Refinement | GitHub-centric overhaul + shadcn/ui adoption: (1) **GitHub OAuth** — replaced Google OAuth with GitHub OAuth; `repo`, `read:user`, `user:email` scopes; OAuth token reused for all GitHub API calls (no separate PAT management); (2) **GitHub-only projects** — removed Confluence, Jira, Beads fields from Project, PRD, and GlobalSettings models; added `githubRepo` (required, unique), `defaultLabels`, `defaultReviewers` to Project; added `githubPrUrl`, `githubPrNumber`, `githubBranch` to PRD; (3) **Single-step submission** — replaced 4-step pipeline (Confluence→Jira→Git→Beads) with single GitHub PR step; re-submission pushes new commit to existing branch; (4) **Per-user repo clones** — RepoCloneService uses user's OAuth token; EFS path `/efs/repos/<user-id>/<project-id>/`; (5) **PostgreSQL FTS** — replaced OpenSearch with `tsvector`/`tsquery` + GIN index; removed OpenSearch from infrastructure; (6) **RepoPicker component** — searchable dropdown listing user's GitHub repos grouped by owner; auto-populates project name; (7) **Admin simplification** — settings reduced to LLM config + workflow settings only; (8) **shadcn/ui adoption** — Sprint 9 with 11 tasks for component library migration: initialization, 13+ components, lucide-react icons, CSS variable theming; (9) **Dead code removal** — ConfluenceService, JiraService, BeadsService, integration-config-service deleted; (10) Added AD-17 through AD-24 architecture decisions; TAC-27 through TAC-34 acceptance criteria; (11) Added Sprints 7–9 (33 new tasks, TASK-057 through TASK-089); total estimate ~478h across 18 weeks; (12) Updated infrastructure sizing: removed OpenSearch ($36/month savings), updated EFS for per-user clones; estimated monthly cost ~$230–420 |
