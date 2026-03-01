# PRD Web Agent

A Next.js 14 web application for AI-powered PRD (Product Requirements Document) lifecycle management. Provides a browser-based UI for non-technical product managers to create, refine, review, and submit PRDs through conversational AI — no terminal or developer skills needed.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (React/Next.js)                      │
│                                                                     │
│  ┌────────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │ Dashboard   │ │ Projects  │ │ PRD List  │ │ PRD Detail Page  │  │
│  │ (overview)  │ │ (CRUD)    │ │ (filter,  │ │ ┌──────────────┐ │  │
│  │             │ │           │ │  search)  │ │ │ Document Tab │ │  │
│  └────────────┘ └───────────┘ └───────────┘ │ │ Chat Tab     │ │  │
│                                              │ │ Comments Tab │ │  │
│                                              │ │ History Tab  │ │  │
│                                              │ └──────────────┘ │  │
│                                              └──────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Socket.io Client ─── /agent (streaming chat)                │  │
│  │                   ─── /notifications (real-time push)        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP REST + WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS SERVER (Node.js)                        │
│                                                                     │
│  ┌─── API Routes (/api/*) ────────────────────────────────────┐    │
│  │ /api/prds, /api/projects, /api/agent, /api/search,         │    │
│  │ /api/notifications, /api/user, /api/auth, /api/internal/*  │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─── Socket.io Server ──────────────────────────────────────┐     │
│  │ /agent namespace     (session mgmt, streaming text deltas) │     │
│  │ /notifications       (real-time push)                      │     │
│  │ Redis adapter        (multi-pod pub/sub)                   │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                     │
│  ┌─── Services Layer ────────────────────────────────────────┐     │
│  │ Agent: SessionManager, PrdGenerator, OpenClawSession      │     │
│  │ Integration: GitHubSubmission, SubmissionPipeline          │     │
│  │ Data: Search, Comments, Notifications, Audit, Workflow     │     │
│  └────────────────────────────────────────────────────────────┘     │
└──────────┬──────────────────┬──────────────────┬────────────────────┘
           ▼                  ▼                  ▼
┌──────────────────┐ ┌─────────────┐ ┌──────────────────────┐
│  PostgreSQL 15   │ │  Redis 7    │ │  OpenClaw Gateway    │
│  (Prisma ORM)    │ │  (Socket.io │ │  (Docker)            │
│                  │ │   adapter,  │ │                      │
│  Users, PRDs,    │ │   session   │ │  /v1/chat/completions│
│  Versions,       │ │   cache)    │ │  (SSE streaming)     │
│  Projects,       │ │             │ │         │            │
│  Comments,       │ └─────────────┘ │         ▼            │
│  Notifications,  │                 │  Anthropic Claude API │
│  Audit, Search   │                 │                      │
└──────────────────┘                 │  Skills: create-prd, │
                                     │          refine-prd  │
                                     └──────────────────────┘
```

## PRD Lifecycle

```
 ┌─────────┐       ┌───────────┐       ┌──────────┐       ┌───────────┐
 │  DRAFT  │──────▶│ IN_REVIEW │──────▶│ APPROVED │──────▶│ SUBMITTED │
 └─────────┘       └───────────┘       └──────────┘       └───────────┘
      │                  │                   │                   │
  AI generates      Reviewers add       Reviewer            GitHub PR
  PRD via chat.     threaded comments.  approves (blocked   created with
  PM refines        Author iterates     if unresolved       PRD markdown,
  iteratively.      with agent.         comments exist).    labels, and
                                                            reviewers.
```

1. **Create** — PM provides a description → agent generates PRD in background → streams content via Socket.io → saves versioned snapshot to DB
2. **Refine** — PM chats with agent in the Chat tab → agent updates PRD iteratively → each save creates a new immutable `PrdVersion`
3. **Review** — Transition to IN_REVIEW → reviewers receive notifications → threaded comments → author refines further
4. **Approve** — Reviewer approves (optionally blocked by unresolved comments)
5. **Submit** — `SubmissionPipeline` creates a GitHub branch, commits PRD markdown, opens a PR with configured labels and reviewers

## Features

- **Conversational PRD Creation** — Chat with an AI agent (Anthropic Claude via OpenClaw Gateway) to generate comprehensive PRDs from a product description
- **Real-Time Streaming** — Watch PRD generation progress in real time via Socket.io WebSocket events
- **Interactive Refinement** — Iteratively improve PRDs through natural language conversation
- **Immutable Version History** — Every agent save creates a new `PrdVersion` snapshot with change summaries
- **Threaded Comments** — Nested comment threads on PRDs with resolve/unresolve tracking
- **Workflow State Machine** — Move PRDs through Draft → In Review → Approved → Submitted with audit trail
- **GitHub PR Submission** — One-click submission creates a branch, commits markdown, and opens a pull request
- **Full-Text Search** — PostgreSQL tsvector-backed search across all PRDs
- **Per-User LLM Settings** — Users can bring their own API key and choose provider/model
- **Real-Time Notifications** — Socket.io push notifications for review requests, comments, and status changes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), TypeScript |
| Database | PostgreSQL 15, Prisma 5 ORM |
| Auth | NextAuth.js v5 (GitHub OAuth) |
| Realtime | Socket.io v4 + Redis adapter |
| AI Agent | OpenClaw Gateway → Anthropic Claude API |
| UI | Tailwind CSS 3, shadcn/ui, Radix primitives |
| Testing | Jest, React Testing Library |
| Observability | OpenTelemetry (traces, metrics, Pino structured logs) |
| Infrastructure | Docker, Helm, process-compose, Devbox |

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (for PostgreSQL and Redis)
- [Devbox](https://www.jetify.com/devbox) (optional, for reproducible environment)
- A GitHub OAuth App (for authentication)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/ldangelo/prd-web-agent.git
cd prd-web-agent
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — from your [GitHub OAuth App](https://github.com/settings/developers)
- `AUTH_SECRET` — a random secret for NextAuth.js (`openssl rand -base64 32`)
- `PI_SDK_API_KEY` — your Anthropic API key (used by OpenClaw for LLM calls)
- `OPENCLAW_GATEWAY_URL` — OpenClaw Gateway URL (default: `http://localhost:18789`)
- `OPENCLAW_GATEWAY_TOKEN` — shared secret for gateway auth (`openssl rand -hex 32`)
- `OPENCLAW_INTERNAL_TOKEN` — shared secret for internal tool callbacks (`openssl rand -hex 32`)

### 3. Start services

```bash
docker compose up -d        # PostgreSQL + Redis + OpenClaw Gateway
npx prisma migrate dev      # Run database migrations
npx prisma db seed           # Seed initial data (optional)
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Using Devbox (alternative)

If you have Devbox installed, the entire setup is scripted:

```bash
devbox shell                 # Enter reproducible environment
devbox run setup             # npm install + prisma generate
devbox run services:up       # Start Docker containers
devbox run db:migrate        # Run migrations
devbox run dev               # Start Next.js dev server
```

Or use process-compose for orchestrated startup:

```bash
process-compose up           # Docker → migrate → next dev (all at once)
```

## Project Structure

```
src/
├── app/                     # Next.js App Router pages and API routes
│   ├── api/                 # REST API endpoints
│   │   ├── prds/            #   PRD CRUD, versions, tags, comments, submit
│   │   ├── projects/        #   Project CRUD, members
│   │   ├── agent/           #   Agent session list and resume
│   │   ├── search/          #   Full-text search
│   │   ├── notifications/   #   Notification fetch and mark-read
│   │   ├── user/            #   Per-user LLM settings
│   │   ├── auth/            #   NextAuth.js handlers
│   │   └── internal/        #   OpenClaw tool callbacks (save/read/list PRD)
│   ├── dashboard/           # Dashboard page
│   ├── prd/                 # PRD detail, list, and creation pages
│   └── projects/            # Project management pages
├── components/              # React components
│   ├── chat/                # Agent chat interface (Socket.io streaming)
│   ├── comments/            # Threaded comment system
│   ├── dashboard/           # Dashboard widgets
│   ├── notifications/       # Notification bell and dropdown
│   ├── prd/                 # PRD document viewer, TOC, tags
│   ├── projects/            # Project forms and cards
│   ├── submission/          # GitHub PR submission modal
│   ├── ui/                  # shadcn/ui primitives
│   └── workflow/            # Status transition buttons
├── hooks/                   # Custom React hooks
├── lib/                     # Shared utilities (API, auth, telemetry)
├── services/                # Business logic
│   ├── agent/               # Agent session manager, PRD generator, tools
│   ├── openclaw/            # OpenClaw HTTP client (SSE streaming)
│   ├── integrations/        # GitHub submission, submission pipeline
│   └── websocket/           # Socket.io server and namespace handlers
└── types/                   # TypeScript type definitions

openclaw/                    # OpenClaw Gateway configuration
├── config/openclaw.json     # Gateway settings (bind, auth, endpoints)
└── skills/                  # Agent skill definitions
    ├── create-prd/          # PRD creation skill with tool endpoints
    └── refine-prd/          # PRD refinement skill
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Lint with ESLint |

## Testing

```bash
npm test                     # Run all tests
npm run test:coverage        # With coverage report
```

Tests are co-located in `__tests__/` directories adjacent to their source files.

## Deployment

A production `Dockerfile` and Helm charts are included:

```bash
docker build -t prd-web-agent .
```

See `helm/` for Kubernetes deployment configuration.

## License

Private — All rights reserved.
