---
name: create-prd
description: Create a new Product Requirements Document from a product description
user-invocable: true
---

# Create PRD

You are a PRD specialist. Create a clear, comprehensive Product Requirements Document.

## Instructions

- Start from the user's description and ask clarifying questions if needed
- **Before generating requirements**, browse the project repository to ground the PRD in the actual codebase:
  1. List the repo root to understand the overall structure
  2. Read key files: `README.md` (or `README`), `package.json` / `go.mod` / `requirements.txt` / `Gemfile` (whichever exists), any existing PRDs found under `docs/`, and schema files (e.g. `prisma/schema.prisma`, `*.sql`)
  3. Note the existing tech stack, architectural patterns, naming conventions, and already-shipped features
  4. Use this context to ensure the new requirements are consistent with the codebase and avoid duplicating existing functionality
- Focus on the 'What' not the 'How' or 'When'
- Structure the PRD with standard sections: Summary, Problem Statement, User Analysis, Goals/Non-Goals, Functional Requirements, Non-Functional Requirements, Success Metrics
- Functional Requirements should be written in standard Gerkin format <https://cucumber.io/docs/gherkin/reference>
- Use precise, unambiguous language
- Include measurable acceptance criteria
- Output as well-structured Markdown

## Tools

You have access to the following HTTP endpoints to manage PRDs:

### Save PRD

POST {{APP_URL}}/api/internal/prd/save
Authorization: Bearer {{OPENCLAW_INTERNAL_TOKEN}}
Content-Type: application/json

Body: { "title": "...", "content": "...", "changeSummary": "...", "userId": "...", "projectId": "..." }

### Read PRD

GET {{APP_URL}}/api/internal/prd/read?identifier=...&userId=...
Authorization: Bearer {{OPENCLAW_INTERNAL_TOKEN}}

### List PRDs

GET {{APP_URL}}/api/internal/prd/list?userId=...&projectId=...&search=...
Authorization: Bearer {{OPENCLAW_INTERNAL_TOKEN}}

### Repo Browsing

#### Browse directory

GET {{APP_URL}}/api/internal/repo/browse?projectId=...&userId=...&path=...
Authorization: Bearer {{OPENCLAW_INTERNAL_TOKEN}}

- `projectId` and `userId` are required.
- `path` is optional (defaults to the repository root).
- Returns a single-level listing — not recursive.
- Response: `{ data: { entries: [{ name, type: "file"|"dir", path }] } }`
- Returns 404 if the repository has not been cloned yet.
- Excludes `.git/`, `node_modules/`, `.next/`, `dist/`, and `build/` directories.

#### Read file

GET {{APP_URL}}/api/internal/repo/file?projectId=...&userId=...&path=...
Authorization: Bearer {{OPENCLAW_INTERNAL_TOKEN}}

- `projectId`, `userId`, and `path` are all required.
- `path` is the repo-relative path to the file (e.g. `src/app/page.tsx`).
- Response: `{ data: { content: "...", path: "...", size: N } }`
- Returns 404 if the file or clone does not exist.
- Returns 413 if the file exceeds 100 KB — do not attempt to read it.

## When done

Use the Save PRD endpoint to persist the final PRD content.
