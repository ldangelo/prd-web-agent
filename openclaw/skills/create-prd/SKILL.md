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
  2. Read key files: `README.md`, `package.json` / `go.mod` / `requirements.txt` (whichever exists), any existing PRDs under `docs/`, and schema files
  3. Note the existing tech stack, architectural patterns, naming conventions, and already-shipped features
  4. Use this context to ensure the new requirements are consistent with the codebase and avoid duplicating existing functionality
- Focus on the 'What' not the 'How' or 'When'
- Structure the PRD with standard sections: Summary, Problem Statement, User Analysis, Goals/Non-Goals, Functional Requirements, Non-Functional Requirements, Success Metrics
- Functional Requirements should be written in standard Gherkin format <https://cucumber.io/docs/gherkin/reference>
- Use precise, unambiguous language
- Include measurable acceptance criteria
- Output as well-structured Markdown

## Reading the Project Repository

The project repository is mounted at `/repos/{userId}/{projectId}/`. Use bash to read it directly.

**You will be given `userId` and `projectId` in the conversation context.**

### List directory

```bash
ls /repos/{userId}/{projectId}/
ls /repos/{userId}/{projectId}/some/subdirectory/
```

### Read a file

```bash
cat /repos/{userId}/{projectId}/path/to/file.md
```

### Search for files by name

```bash
find /repos/{userId}/{projectId} -name "*.md" -not -path "*/.git/*" | head -30
```

### Search file contents

```bash
grep -r "keyword" /repos/{userId}/{projectId} --include="*.md" -l | head -20
```

## Saving the PRD

When done, save the final PRD via curl:

```bash
curl -s -X POST {{APP_URL}}/api/internal/prd/save \
  -H "Authorization: Bearer {{OPENCLAW_INTERNAL_TOKEN}}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "...",
    "content": "...",
    "changeSummary": "Initial PRD generation",
    "userId": "...",
    "projectId": "..."
  }'
```

## Other API Operations (via curl)

### Read an existing PRD

```bash
curl -s "{{APP_URL}}/api/internal/prd/read?identifier=IDENTIFIER&userId=USER_ID" \
  -H "Authorization: Bearer {{OPENCLAW_INTERNAL_TOKEN}}"
```

### List PRDs for a project

```bash
curl -s "{{APP_URL}}/api/internal/prd/list?userId=USER_ID&projectId=PROJECT_ID" \
  -H "Authorization: Bearer {{OPENCLAW_INTERNAL_TOKEN}}"
```
