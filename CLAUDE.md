# CLAUDE.md — PRD Web Agent

## Project Overview

Next.js 14 web app for AI-powered PRD lifecycle management. Product managers create,
refine, and submit PRDs through a chat-driven UI backed by Claude (via OpenClaw gateway).

**Active bookmarks:** `feat/per-project-roles`, `fix/prd-generation-bugs`, `fix/ui-api-auth-bugs`

---

## Quick Reference

| Task | Command |
|------|---------|
| Start dev server | `devbox run dev` |
| Run tests | `devbox run test` |
| DB migrate | `devbox run db:migrate` |
| Start all services | `process-compose up` |
| Start Docker services | `devbox run services:up` |
| Find work | `bd ready` |
| Claim issue | `bd update <id> --status in_progress` |
| Close issue | `bd close <id>` |
| VCS status | `jj status` |
| New change | `jj new` |
| Describe change | `jj describe -m "feat: ..."` |

---

## Source Control — jj (Jujutsu)

**ALWAYS use `jj` — NEVER `git` directly.**

```bash
jj status              # working copy status
jj log                 # commit history
jj describe -m "msg"   # set commit message on working copy
jj new                 # start new change
jj bookmark set <name> # set bookmark (branch equivalent)
```

---

## Architecture

```
src/
├── app/
│   ├── api/           # Next.js App Router route handlers
│   │   ├── prds/      # PRD CRUD, comments, generate, status
│   │   ├── projects/  # Project + member management
│   │   ├── agent/     # Agent session endpoints
│   │   ├── github/    # GitHub submission integration
│   │   ├── search/    # OpenSearch queries
│   │   └── internal/  # Internal webhooks (prd/save, repo/*)
│   └── (pages)/       # App Router UI pages
├── components/        # React UI (chat, comments, dashboard, prd, projects, workflow)
├── lib/               # Utilities: api/, auth/, telemetry/
├── services/          # Business logic
│   ├── agent/         # OpenClaw agent session + PRD generator
│   ├── openclaw/      # OpenClaw API client
│   ├── integrations/  # External integrations
│   ├── comment-service.ts
│   ├── status-workflow-service.ts
│   ├── prd-access-service.ts
│   ├── repo-clone-service.ts
│   ├── search-service.ts
│   └── notification-service.ts
└── types/             # Shared TypeScript types

prisma/schema.prisma   # Models: User, Project, ProjectMember, Prd, PrdVersion,
                       #   PrdCoAuthor, Comment, Notification, AuditEntry,
                       #   GlobalSettings, UserLlmSettings
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14, App Router, TypeScript |
| ORM | Prisma 5 + PostgreSQL 15 |
| Auth | NextAuth.js v5 (OAuth: Google, Okta, Azure AD) |
| AI Gateway | OpenClaw (Docker container, port 18790) |
| Realtime | Socket.io + Redis adapter |
| Search | OpenSearch |
| Styling | Tailwind CSS 3 |
| Testing | Jest + React Testing Library |
| Telemetry | OpenTelemetry (traces, metrics, Pino structured logs) |
| Infra | Docker, Helm, LocalStack (S3/SQS) |

---

## Key Conventions

- **API responses**: Always wrapped `{ data: T }` via `apiSuccess()`. Clients must use `json.data`.
- **Logging**: Use `logger` from `@/lib/logger` — never `console.error/log`.
  - Pattern: `logger.error({ error }, "message")`
- **API routes**: `src/app/api/<resource>/route.ts`
- **Tests**: Co-located `__tests__/` next to source files
- **Commit style**: `feat(TASK-NNN): description` or `feat: description`
- **Env config**: `.env.example` is the template; `.env` is local (gitignored)
- **Error handling**: Use `handleApiError`, `NotFoundError`, `ForbiddenError` from `@/lib/api/errors`

---

## OpenClaw / AI Gateway

- **Docker container**: `prd-web-agent-openclaw`, port **18790**
- **Token env var**: `OPENCLAW_GATEWAY_TOKEN` in `.env`
- **URL env var**: `OPENCLAW_GATEWAY_URL=http://localhost:18790`
- The Docker container inherits `OPENCLAW_GATEWAY_TOKEN` from launchd — `.env` must match.
- Local LaunchAgent openclaw (port 18789) is NOT used by this app.
- Agent sessions: `src/services/agent/`, `src/services/openclaw/`

---

## Key Paths

- **Prisma schema**: `prisma/schema.prisma`
- **Auth config**: `src/lib/auth.ts`, `src/middleware.ts`
- **API helpers**: `src/lib/api/response.ts`, `src/lib/api/errors.ts`
- **PRD generator**: `src/services/agent/prd-generator.ts`
- **Status workflow**: `src/services/status-workflow-service.ts`
- **Docker compose**: `docker-compose.yml`
- **Helm charts**: `helm/`
- **PRD doc**: `docs/PRD/prd-web-agent-prd.md`
- **TRD doc**: `docs/TRD/prd-web-agent-trd.md`

---

## Session Workflow

```bash
# Start work
bd ready                              # find available issues
bd update <id> --status in_progress   # claim it

# Do the work
devbox run test                       # run tests

# Finish
bd close <id>                         # mark done
jj describe -m "feat: ..."            # describe the change
bd dolt push                          # sync beads to Dolt remote
```

---

## Common Pitfalls

- **API envelope**: All API responses are `{ data: T }` — always destructure `json.data` in clients.
- **jj vs git**: Never use `git commit`, `git push`, etc. Use `jj` equivalents.
- **OpenClaw token mismatch**: If getting 401s, verify `.env` `OPENCLAW_GATEWAY_TOKEN` matches the Docker container's launchd-injected value.
- **Prisma enum changes**: Require a migration file in `prisma/migrations/`.
- **Auth in API routes**: Use `requireAuth()` from `@/lib/auth` — never trust client-supplied user IDs.
