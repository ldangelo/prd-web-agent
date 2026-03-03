# CLAUDE.md — PRD Web Agent

## Project Overview

A Next.js 14 web application for AI-powered PRD (Product Requirements Document) lifecycle management. Provides a web UI for non-technical product managers to create, refine, and submit PRDs using the Ensemble workflow.

## Architecture

```
prd-web-agent/
├── src/                   # Application source
│   ├── app/               # Next.js App Router pages and API routes
│   ├── components/        # React components (chat, comments, dashboard, notifications, prd, projects, submission, workflow)
│   ├── lib/               # Shared utilities (api, auth, telemetry)
│   ├── services/          # Business logic (agent, integrations, websocket)
│   └── types/             # TypeScript type definitions
├── prisma/                # Database schema and migrations
├── helm/                  # Kubernetes Helm charts
├── public/                # Static assets
├── devbox.json            # Reproducible dev environment (Nix)
├── process-compose.yaml   # Orchestrated startup
├── docker-compose.yml     # Local services (postgres, redis, opensearch)
├── Dockerfile             # Production container
└── docs/                  # PRD, TRD, standards
```

## Source Control

**Use jj (Jujutsu) — NOT git directly.**

```bash
jj status              # working copy status
jj log                 # commit history
jj describe -m "msg"   # set commit message on working copy
jj new                 # start new change
jj bookmark set <name> # set bookmark (branch equivalent)
```

## Issue Tracking

**Use bd (beads)** — `bd ready`, `bd show <id>`, `bd update <id> --status in_progress`, `bd close <id>`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14, App Router, TypeScript |
| ORM | Prisma 5 + PostgreSQL 15 |
| Auth | NextAuth.js v5 (OAuth: Google, Okta, Azure AD) |
| Realtime | Socket.io + Redis adapter |
| Search | OpenSearch |
| Styling | Tailwind CSS 3 |
| Testing | Jest + React Testing Library |
| Telemetry | OpenTelemetry (traces, metrics, structured logs via Pino) |
| Infra | Docker, Helm, LocalStack (S3/SQS) |

## Dev Environment (devbox)

```bash
devbox shell              # enter reproducible env
devbox run setup          # npm install + prisma generate
devbox run services:up    # docker containers (postgres, redis, opensearch)
devbox run db:migrate     # prisma migrate dev
devbox run dev            # next.js dev server
devbox run doctor         # check everything is healthy
devbox run test           # jest
```

Full orchestrated startup: `process-compose up` (docker → migrate → next dev)

## Key Paths

- **App source**: `src/`
  - `app/` — Next.js App Router pages and API routes
  - `components/` — React components
  - `lib/` — Shared utilities (api, auth, telemetry)
  - `services/` — Business logic (agent, integrations, websocket)
  - `types/` — TypeScript type definitions
- **Prisma schema**: `prisma/schema.prisma`
- **Docker compose**: `docker-compose.yml`
- **Helm charts**: `helm/`
- **PRD**: `docs/PRD/prd-web-agent-prd.md`
- **TRD**: `docs/TRD/prd-web-agent-trd.md`

## Conventions

- **Commit style**: `feat(TASK-NNN): description` or `feat: description`
- **API routes**: `src/app/api/<resource>/route.ts` (Next.js App Router conventions)
- **Tests**: Co-located in `__tests__/` directories adjacent to source
- **Env config**: `.env.example` is the template; `.env` is local (gitignored)

## Session Workflow

1. `bd ready` — find available work
2. `bd update <id> --status in_progress` — claim it
3. Do the work, run tests (`devbox run test`)
4. `bd close <id>` — mark done
5. `jj describe -m "feat: ..."` — describe the change
6. `bd dolt push` — push beads issue database to Dolt remote
