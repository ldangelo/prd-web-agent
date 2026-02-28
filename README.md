# PRD Web Agent

A Next.js web application for AI-powered PRD (Product Requirements Document) lifecycle management. Provides a web UI for product managers to create, refine, and submit PRDs using the [Ensemble](https://github.com/anthropics/claude-code) agent workflow.

## Features

- **AI-Powered Generation** — Invoke the `/create-prd` skill via the Pi SDK to generate comprehensive PRDs from a product description
- **Real-Time Streaming** — Watch PRD generation progress in real time via WebSocket events
- **Interactive Refinement** — Chat with the AI agent to iteratively improve your PRD
- **Version History** — Track every revision with full version history and diffs
- **Collaborative Comments** — Threaded comments on PRD sections for team feedback
- **Workflow Management** — Move PRDs through Draft, Review, Approved, and Submitted states
- **GitHub Integration** — Connect projects to GitHub repos, submit PRDs as pull requests
- **Full-Text Search** — PostgreSQL-backed search across all PRDs and projects

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), TypeScript |
| Database | PostgreSQL 15, Prisma 5 ORM |
| Auth | NextAuth.js v5 (GitHub OAuth) |
| Realtime | Socket.io + Redis adapter |
| AI Agent | Pi SDK (Anthropic Claude) |
| UI | Tailwind CSS 3, shadcn/ui, Radix primitives |
| Testing | Jest, React Testing Library |
| Observability | OpenTelemetry (traces, metrics, Pino structured logs) |
| Infrastructure | Docker, Helm, process-compose |

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
- `PI_SDK_API_KEY` — your Anthropic API key (for AI generation)

### 3. Start services

```bash
docker compose up -d        # PostgreSQL + Redis
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
│   ├── dashboard/           # Dashboard page
│   ├── prd/                 # PRD detail, list, and creation pages
│   └── projects/            # Project management pages
├── components/              # React components
│   ├── chat/                # Agent chat interface
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
│   ├── agent/               # Pi SDK integration, session management
│   └── websocket/           # Socket.io namespace handlers
└── types/                   # TypeScript type definitions
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
