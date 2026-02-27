# Product Requirements Document (PRD) — PRD Web Agent

> **Version:** 2.0  
> **Last Updated:** 2026-02-26  
> **Status:** Draft  
> **Author:** PRD Web Agent (auto-generated, refined via stakeholder interview)

---

## Table of Contents

1. [Product Summary](#product-summary)
2. [Problem Statement](#problem-statement)
3. [User Analysis](#user-analysis)
4. [Goals & Non-Goals](#goals--non-goals)
5. [Functional Requirements](#functional-requirements)
6. [Non-Functional Requirements](#non-functional-requirements)
7. [Acceptance Criteria](#acceptance-criteria)
8. [Phased Delivery Plan](#phased-delivery-plan)
9. [Open Questions](#open-questions)
10. [Version History](#version-history)

---

## Product Summary

### Solution Overview

The **PRD Web Agent** is a cloud-hosted web application that gives Product Managers a browser-based interface for creating, refining, managing, and submitting Product Requirements Documents. It is powered by the pi coding agent SDK, exposing the `create-prd` and `refine-prd` skills through a conversational chat UI — no terminal required.

The application provides a full PRD lifecycle: draft creation via AI-guided conversation, collaborative refinement with version history, a status workflow (Draft → In Review → Approved → Submitted), and a one-click submission pipeline that publishes to Confluence, creates a Jira Epic, opens a Git PR, and files a Beads issue.

All PRD content changes are made exclusively through agent conversations — there is no manual text editor. This ensures every change has a full conversation trail and maintains document consistency through the AI-guided workflow.

### Value Proposition

- **Accessible AI-powered PRD authoring** — PMs interact with a chat agent in their browser instead of learning terminal-based tooling
- **End-to-end lifecycle management** — One place to create, track, review, approve, and submit PRDs
- **Automated submission pipeline** — Eliminates manual copy-paste across Confluence, Jira, Git, and Beads
- **Team collaboration** — Multiple PMs can comment, review, and co-own PRDs with full version history
- **Project organization** — PRDs are organized by project with configurable integration targets per project

---

## Problem Statement

Product Managers need to create and maintain high-quality PRDs as the starting point for engineering work. Today this involves:

1. **Tool friction** — The pi agent's `create-prd` and `refine-prd` skills are only accessible through the terminal TUI. PMs are not comfortable in the terminal and cannot use these skills without developer assistance.
2. **Manual handoff** — Once a PRD is written, a PM must manually publish it to Confluence, create a Jira ticket, and communicate with engineering to begin work. This is error-prone and slow.
3. **No collaboration layer** — PRDs stored as Markdown files in a repo have no commenting, status tracking, or version comparison visible to non-technical stakeholders.
4. **Fragmented workflow** — PMs switch between Google Docs, Confluence, Jira, Slack, and email to manage what should be a single linear process.

The PRD Web Agent eliminates these problems by providing a single web-based interface that wraps the pi agent's PRD skills with document management, collaboration, and automated submission.

---

## User Analysis

### Target Users

**Primary:** Product Managers  
**Secondary:** Technical Program Managers, Product Owners, Engineering Leads (as reviewers)

### Persona 1: The Product Manager (Primary)

| Attribute | Detail |
|-----------|--------|
| **Profile** | Mid-to-senior PM responsible for writing PRDs that drive engineering sprints |
| **Technical comfort** | Comfortable with web apps (Jira, Confluence, Figma); **not** comfortable with terminal, CLI, or git |
| **Pain points** | Spends hours writing PRDs from scratch; manual copy-paste to Confluence/Jira; no structured feedback loop before handoff; loses track of PRD versions |
| **Current workflow** | Google Docs → share for comments → copy to Confluence → manually create Jira epic → Slack ping to engineering |
| **What changes** | Opens PRD Web Agent → chats with AI to create PRD → shares for review → clicks "Submit" → Confluence page, Jira ticket, PR, and Beads issue are created automatically |

### Persona 2: The Reviewing PM / TPM (Secondary)

| Attribute | Detail |
|-----------|--------|
| **Profile** | Peer PM or TPM who reviews PRDs before they go to engineering |
| **Pain points** | Reviews happen ad-hoc in Docs/Slack; no structured approval workflow; hard to track which version was reviewed |
| **What changes** | Receives notification of PRD in "In Review" status → reads rendered PRD in web UI → leaves comments → approves or requests changes |

### Persona 3: The Engineering Lead (Secondary)

| Attribute | Detail |
|-----------|--------|
| **Profile** | Tech lead or engineering manager who consumes submitted PRDs |
| **Pain points** | PRDs arrive in inconsistent formats; no single place to find the latest version; manual linking between Confluence/Jira |
| **What changes** | Receives a Jira ticket with a Confluence link and a PR with the PRD Markdown — all auto-generated from a structured, AI-assisted document |

### User Journey (Primary — PM Creating a PRD)

```
1. PM logs into PRD Web Agent via SSO/OAuth
2. PM selects a project (or creates one)
3. PM clicks "New PRD" → enters a brief product description
4. Agent session starts with create-prd skill loaded
5. PM chats with the agent; agent asks clarifying questions per the create-prd workflow
6. Agent generates the PRD and saves it; status = "Draft"
7. PM reviews the rendered PRD in the document viewer
8. PM optionally starts a refine-prd session to iterate
9. PM adds tags/labels for organization
10. PM moves status to "In Review" → project reviewers are auto-notified
11. Reviewers leave document-level comments; PM addresses them via refine-prd conversations
12. Reviewer approves → status moves to "Approved" (single approver sufficient)
13. PM clicks "Submit for Development"
14. System automatically:
    a. Publishes PRD to Confluence (using project's configured space)
    b. Creates Jira Epic with acceptance criteria and Confluence link (using project's Jira config)
    c. Opens a Git PR with the PRD Markdown
    d. Creates a Beads issue with links to Confluence and Jira
15. Status moves to "Submitted"
16. If engineering requests changes, PM can re-open → status returns to "Draft" for revision
```

---

## Goals & Non-Goals

### Goals

| # | Goal | Success Metric |
|---|------|---------------|
| G1 | PMs can create PRDs through a web chat interface without using the terminal | 100% of PRD creation happens through the WebUI; zero terminal usage required |
| G2 | PRDs follow a structured lifecycle from Draft to Submitted | Every PRD passes through at least Draft → Approved → Submitted |
| G3 | Submission pipeline automates Confluence, Jira, Beads, and PR creation | One-click submit creates all four artifacts within 60 seconds |
| G4 | Multiple PMs can work simultaneously on separate PRDs | System supports ≥10 concurrent agent sessions without degradation |
| G5 | PMs can collaborate via comments and status workflow | Reviewers can comment and approve/reject PRDs within the web UI |
| G6 | Full version history is maintained for every PRD | Every agent-driven change creates a version; PMs can view any previous version |
| G7 | System deploys to AWS Kubernetes for shared team access | Accessible via browser on corporate network; no local installation required |
| G8 | PRDs are organized by project with configurable integration targets | Each project can map to its own Confluence space, Jira project, and Git repo |
| G9 | Full observability via OpenTelemetry | Distributed tracing, structured logging, and metrics (including custom PRD-by-status metrics) are available from day one |

### Non-Goals

| # | Non-Goal | Rationale |
|---|----------|-----------|
| N1 | General-purpose coding agent in the browser | This is a PRD-specific tool; full pi agent capabilities are out of scope |
| N2 | TRD creation or implementation workflows | Downstream from PRD; handled by engineering using pi directly |
| N3 | Real-time collaborative editing (Google Docs-style) | PRDs are authored through agent conversations, not simultaneous text editing |
| N4 | Manual PRD text editing | All changes go through agent conversations to maintain conversation trail and document consistency |
| N5 | Mobile-native application | Web-responsive design is sufficient; native apps are out of scope |
| N6 | Self-hosted / on-premise deployment option (v1) | Initial release targets AWS EKS only |
| N7 | Custom LLM model hosting | Uses existing LLM provider APIs (Anthropic, OpenAI, etc.) via pi SDK |
| N8 | LLM token/cost limits | No per-user or per-session token budgets for v1; Admin monitors usage via metrics |
| N9 | PRD archiving or deletion | PRDs accumulate; users filter by status. Archiving deferred to a future release |

---

## Functional Requirements

### FR-1: Authentication & User Management

- **FR-1.1:** Users authenticate via OAuth 2.0 / SSO (e.g., Google Workspace, Okta, or corporate SAML)
- **FR-1.2:** Users have roles: **Author** (create/edit own PRDs), **Reviewer** (comment/approve any PRD), **Admin** (manage users, configure integrations, manage projects)
- **FR-1.3:** All actions are attributed to the authenticated user
- **FR-1.4:** Session tokens expire after configurable idle timeout (default: 8 hours)

### FR-2: Project Management

- **FR-2.1:** **Projects** are a first-class entity in the system; every PRD belongs to exactly one project
- **FR-2.2:** Users can create, edit, and configure projects from a dedicated Projects interface
- **FR-2.3:** Project configuration includes:
  - Project name and description
  - Assigned reviewers (auto-assigned when any PRD in the project moves to "In Review")
  - Integration overrides: Confluence space, Jira project, Git repository, Beads project (overrides global defaults)
- **FR-2.4:** Global integration defaults are configured in Admin settings; per-project settings override globals when present
- **FR-2.5:** Users can view all projects they have access to

### FR-3: PRD Creation via Agent Chat

- **FR-3.1:** User selects a project, clicks "New PRD", and provides an initial product description (free-text input)
- **FR-3.2:** System creates a pi `AgentSession` with the `create-prd` skill loaded via the pi SDK
- **FR-3.3:** The system prompt is scoped to PRD creation — the agent has no access to arbitrary bash commands, code editing, or system tools
- **FR-3.4:** The chat interface streams agent responses in real time (via WebSocket or SSE) showing text deltas as they arrive
- **FR-3.5:** The agent follows the `create-prd` workflow: product analysis → requirements definition → PRD generation
- **FR-3.6:** When the agent produces a PRD document, it is saved as version 1 with status "Draft" and linked to the conversation session and project
- **FR-3.7:** Users can attach images to chat messages (e.g., mockups, diagrams) which are forwarded to the agent as image content
- **FR-3.8:** Chat history is persisted per-session using pi `SessionManager`; users can resume incomplete conversations
- **FR-3.9:** There is no manual text editing of PRD content — all changes are made through agent conversations

### FR-4: PRD Refinement via Agent Chat

- **FR-4.1:** From a PRD detail view, user clicks "Refine" to start a refinement session
- **FR-4.2:** System creates a new `AgentSession` with the `refine-prd` skill loaded and the current PRD content injected as context
- **FR-4.3:** The agent follows the `refine-prd` workflow: reviews the PRD, asks clarifying questions one at a time, integrates feedback
- **FR-4.4:** Upon completion, the refined PRD is saved as a new version; previous version is preserved in history
- **FR-4.5:** Multiple refinement sessions can occur on the same PRD; each creates a new version
- **FR-4.6:** Lightweight changes (e.g., "fix the typo in section 3") are handled through the same refine-prd conversation flow

### FR-5: PRD Document Management

- **FR-5.1:** **Dashboard / List View** — Displays all PRDs the user has access to in a flat list with columns: Title, Project, Author, Status, Tags, Last Updated, Version
- **FR-5.2:** **Filters & Search** — Filter by project, status, author, tags, date range; full-text search across PRD content
- **FR-5.3:** **Detail View** — Renders the PRD Markdown as formatted HTML with a table of contents
- **FR-5.4:** **Version History** — Shows a chronological list of all versions with author, timestamp, and change summary
- **FR-5.5:** **Tags/Labels** — Users can add, edit, and remove free-form tags on any PRD for organization and filtering
- **FR-5.6:** **Ownership** — PRDs have a primary author and optional co-authors; co-authors can refine
- **FR-5.7:** **PDF Export** — Users can export the current PRD version as a formatted PDF document

### FR-6: Status Workflow

- **FR-6.1:** PRDs follow a status lifecycle:
  ```
  Draft → In Review → Approved → Submitted
    ↑         ↓           ↓          ↓
    ├── Draft (rejected)   │          │
    ├── Draft (revisions)──┘          │
    └── Draft (re-opened) ───────────┘
  ```
- **FR-6.2:** **Draft** — Initial state. Only the author (and co-authors) can refine via agent conversations
- **FR-6.3:** **In Review** — Author moves PRD to review; reviewers configured on the project are auto-notified
- **FR-6.4:** **Approved** — Any single reviewer can approve the PRD; unlocks the "Submit for Development" action
- **FR-6.5:** **Submitted** — After submission pipeline completes; links to all created artifacts are stored
- **FR-6.6:** **Rejection** — Reviewer can reject and move back to Draft with a required comment explaining why
- **FR-6.7:** **Re-open** — A Submitted PRD can be re-opened back to Draft for revisions (e.g., when engineering requests changes). Re-submission updates existing Confluence page and Jira ticket rather than creating duplicates
- **FR-6.8:** Status transitions are logged in an audit trail with timestamp and user

### FR-7: Collaboration & Comments

- **FR-7.1:** Users can leave comments on a PRD at the document level (general comments)
- **FR-7.2:** Comments support threaded replies
- **FR-7.3:** Comments can be marked as "Resolved" by the author or the commenter
- **FR-7.4:** Unresolved comments block transition to "Approved" status (configurable — can be overridden by Admin)
- **FR-7.5:** In-app notifications for: new comment, comment reply, status change, review requested

### FR-8: Submission Pipeline ("Submit for Development")

- **FR-8.1:** Available only when PRD status is "Approved"
- **FR-8.2:** Triggered by a single "Submit for Development" button click
- **FR-8.3:** The pipeline executes the following steps in order, with progress reported to the UI:

| Step | Action | Detail |
|------|--------|--------|
| 1 | **Confluence** | Create a Confluence page (or update existing on re-submission) under the project's configured space/parent page with the rendered PRD content |
| 2 | **Jira** | Create a Jira Epic (or update existing on re-submission) in the project's configured Jira project. Epic description includes the PRD summary, full acceptance criteria, and a link to the Confluence page |
| 3 | **Git PR** | Commit the PRD Markdown file to the project's configured repository branch and open a Pull Request against the main branch |
| 4 | **Beads** | Create a Beads issue (`bd create`) with the PRD title, linking to the Confluence page and Jira ticket |

- **FR-8.4:** Each step reports success/failure independently; partial failures do not roll back completed steps
- **FR-8.5:** On partial failure, the user can retry failed steps individually
- **FR-8.6:** Upon full success, the PRD status moves to "Submitted" and links to all created artifacts are displayed and stored
- **FR-8.7:** Integration credentials (Confluence API token, Jira API token, Git access token, Beads config) are managed in admin settings — not entered by PMs
- **FR-8.8:** On re-submission (after re-opening), the pipeline updates existing Confluence page and Jira Epic using stored artifact links; creates a new PR for the updated content

### FR-9: Agent Configuration & Scoping

- **FR-9.1:** Agent sessions use the pi SDK `createAgentSession()` with a custom `ResourceLoader` that loads only `create-prd` and `refine-prd` skills
- **FR-9.2:** The agent's system prompt is overridden to include:
  - Role: "You are a Product Requirements assistant helping Product Managers create and refine PRDs"
  - Constraints: No code execution, no file system access beyond PRD documents
  - Context: The current PRD content (for refinement sessions)
- **FR-9.3:** Tools are restricted to a custom set:
  - `save_prd` — Saves the generated/refined PRD to the system
  - `list_prds` — Lists existing PRDs (for cross-referencing)
  - `read_prd` — Reads a specific PRD's content
  - No `bash`, `edit`, `write`, or other system tools
- **FR-9.4:** LLM model and thinking level are configurable by Admin (not per-user)
- **FR-9.5:** API keys for LLM providers are stored server-side; PMs never see or manage them
- **FR-9.6:** When a PM prompts the agent for something outside its scope (e.g., "write me some code"), the agent responds with a polite refusal and redirects to PRD-related tasks

### FR-10: Notifications

- **FR-10.1:** In-app notification bell with unread count
- **FR-10.2:** Notification triggers:
  - PRD moved to "In Review" → notify project's assigned reviewers
  - New comment on a PRD you authored or are reviewing
  - PRD approved/rejected → notify author
  - Submission pipeline complete → notify author with artifact links
- **FR-10.3:** Notifications link directly to the relevant PRD

### FR-11: Admin Settings

- **FR-11.1:** **Global Integration Defaults** — Default Confluence space, Jira project, Git repository, Beads project (used when project does not override)
- **FR-11.2:** **User Management** — Add/remove users, assign roles (Author, Reviewer, Admin)
- **FR-11.3:** **LLM Configuration** — Select provider, model, thinking level; manage API keys
- **FR-11.4:** **Workflow Configuration** — Toggle whether unresolved comments block approval; configure notification preferences
- **FR-11.5:** **Audit Log** — View all status transitions, submissions, and admin actions

---

## Non-Functional Requirements

| # | Requirement | Target | Measurement |
|---|------------|--------|-------------|
| NFR-1 | **Concurrent Users** | ≥10 simultaneous agent chat sessions without degradation | Load test with 10 concurrent sessions; p95 response time <2s for non-LLM operations |
| NFR-2 | **Agent Response Latency** | First token visible within 3 seconds of message send | Measured from WebSocket message send to first `text_delta` event received |
| NFR-3 | **Submission Pipeline Speed** | All four submission steps complete within 60 seconds | Timed from "Submit" click to all artifacts created |
| NFR-4 | **Availability** | 99.5% uptime during business hours (M–F, 8am–8pm) | Monitored via health check endpoint and OTel metrics |
| NFR-5 | **Data Durability** | Zero PRD data loss | All PRD content and versions stored in persistent database with daily backups |
| NFR-6 | **Security — Authentication** | All endpoints require valid auth token; no anonymous access | Penetration test validates; auth bypass = P0 bug |
| NFR-7 | **Security — Secrets** | LLM API keys and integration tokens never exposed to frontend | Keys stored encrypted at rest; never included in API responses |
| NFR-8 | **Security — Agent Sandboxing** | Agent cannot execute arbitrary commands or access files outside PRD scope | Agent created with custom tool set (no bash/edit/write); validated via integration tests |
| NFR-9 | **Accessibility** | WCAG 2.1 AA compliance | Automated accessibility scan (axe-core) passes; keyboard navigation works throughout |
| NFR-10 | **Scalability** | Horizontal scaling of backend pods behind a load balancer | Kubernetes HPA configured; session affinity via sticky sessions or shared session store |
| NFR-11 | **Deployment** | Containerized and deployed to AWS EKS | Helm chart or Kustomize manifests; CI/CD pipeline for automated deployment |
| NFR-12 | **Browser Support** | Chrome, Firefox, Safari, Edge (latest 2 versions) | Manual QA on each browser |
| NFR-13 | **Responsive Design** | Usable on tablet-sized screens (≥768px width) | Verified via responsive testing |
| NFR-14 | **Observability — Tracing** | Distributed tracing across all backend services and external API calls | OpenTelemetry traces exported to collector; trace IDs propagated across service boundaries |
| NFR-15 | **Observability — Logging** | Structured JSON logging with trace correlation | All log entries include trace ID, span ID, user ID, and operation context |
| NFR-16 | **Observability — Metrics** | Standard RED metrics (Rate, Errors, Duration) plus custom PRD metrics | OTel metrics exported; custom gauges for PRD count by status (draft, in_review, approved, submitted) |
| NFR-17 | **Observability — Alerting** | Alerts for service health, LLM API errors, and submission pipeline failures | Alert rules configured on OTel metrics; delivery via PagerDuty, Slack, or email |

---

## Acceptance Criteria

### AC-1: PRD Creation via Chat

- [ ] **AC-1.1:** PM logs in, selects a project, clicks "New PRD", enters "A mobile app for tracking daily water intake", and a chat session starts with the agent asking clarifying questions per the `create-prd` workflow
- [ ] **AC-1.2:** Agent responses stream token-by-token in the chat UI with <3s time-to-first-token
- [ ] **AC-1.3:** After the conversation completes, a PRD document appears in the dashboard with status "Draft" under the selected project
- [ ] **AC-1.4:** The generated PRD contains all required sections: Product Summary, User Analysis, Goals & Non-Goals, Functional Requirements, Non-Functional Requirements, Acceptance Criteria
- [ ] **AC-1.5:** The PM can close the browser and reopen to find the chat session and PRD intact

### AC-2: PRD Refinement

- [ ] **AC-2.1:** PM opens a Draft PRD and clicks "Refine"; a new chat session starts with the agent having read the existing PRD
- [ ] **AC-2.2:** The agent asks targeted questions about gaps in the current PRD per the `refine-prd` workflow
- [ ] **AC-2.3:** After refinement, a new version (v2) is saved; the previous version (v1) remains accessible in version history
- [ ] **AC-2.4:** Version history shows both versions with timestamps and change summaries
- [ ] **AC-2.5:** PM says "fix the typo in section 3 — change 'recieve' to 'receive'" and the agent produces an updated version with just that fix

### AC-3: Project Management

- [ ] **AC-3.1:** User creates a new project with name, description, and assigned reviewers
- [ ] **AC-3.2:** User configures project-specific Confluence space and Jira project that override global defaults
- [ ] **AC-3.3:** PRDs created under this project use the project's integration settings during submission
- [ ] **AC-3.4:** When no project override is set, the global default integration settings are used

### AC-4: Status Workflow

- [ ] **AC-4.1:** A Draft PRD can be moved to "In Review"; moving triggers an in-app notification to the project's assigned reviewers
- [ ] **AC-4.2:** A single reviewer can approve a PRD, moving it to "Approved"
- [ ] **AC-4.3:** A reviewer can reject a PRD with a required comment, moving it back to "Draft"
- [ ] **AC-4.4:** "Submit for Development" button is only visible/enabled on Approved PRDs
- [ ] **AC-4.5:** A Submitted PRD can be re-opened back to Draft; the PRD retains its links to previously created artifacts
- [ ] **AC-4.6:** The status transition audit trail shows who changed what status and when

### AC-5: Collaboration

- [ ] **AC-5.1:** A reviewer adds a document-level comment to a PRD in "In Review" status; the author receives a notification
- [ ] **AC-5.2:** The author replies to the comment; a threaded conversation is visible
- [ ] **AC-5.3:** The author marks the comment as resolved; it collapses but remains visible
- [ ] **AC-5.4:** If unresolved comments exist and the "block approval" setting is on, the reviewer cannot approve

### AC-6: Submission Pipeline

- [ ] **AC-6.1:** PM clicks "Submit for Development" on an Approved PRD
- [ ] **AC-6.2:** Progress UI shows four steps with individual status indicators (pending → in progress → success/failed)
- [ ] **AC-6.3:** A Confluence page is created with the PRD content under the project's configured space
- [ ] **AC-6.4:** A Jira Epic is created with the PRD title, acceptance criteria in the description, and a link to the Confluence page
- [ ] **AC-6.5:** A Git PR is opened with the PRD Markdown file committed to the project's configured repository
- [ ] **AC-6.6:** A Beads issue is created with links to the Confluence page and Jira ticket
- [ ] **AC-6.7:** All four artifact links are displayed on the PRD detail view
- [ ] **AC-6.8:** If Confluence creation fails but the other steps haven't run, the user can retry just the Confluence step
- [ ] **AC-6.9:** The entire pipeline completes within 60 seconds

### AC-7: Re-submission

- [ ] **AC-7.1:** A previously Submitted PRD is re-opened, refined, re-approved, and re-submitted
- [ ] **AC-7.2:** The existing Confluence page is updated (not duplicated)
- [ ] **AC-7.3:** The existing Jira Epic is updated with revised acceptance criteria (not duplicated)
- [ ] **AC-7.4:** A new Git PR is opened with the updated PRD content

### AC-8: Concurrent Usage

- [ ] **AC-8.1:** Two PMs simultaneously create PRDs in separate chat sessions; both receive streaming responses without cross-contamination
- [ ] **AC-8.2:** Under load of 10 concurrent sessions, non-LLM API calls (list, filter, comment) respond in <500ms (p95)

### AC-9: Security & Sandboxing

- [ ] **AC-9.1:** Unauthenticated requests to any API endpoint return 401
- [ ] **AC-9.2:** The agent cannot execute shell commands — prompting it to "run `ls -la`" returns a polite refusal
- [ ] **AC-9.3:** LLM API keys are not present in any frontend bundle, API response, or browser network request
- [ ] **AC-9.4:** A PM cannot view or modify another PM's draft PRD unless they are a co-author or reviewer

### AC-10: Admin

- [ ] **AC-10.1:** Admin can configure global default Confluence space, Jira project, and Git repo from the settings page
- [ ] **AC-10.2:** Admin can add a user and assign the Reviewer role; that user can then approve PRDs
- [ ] **AC-10.3:** Admin can change the LLM model; subsequent new agent sessions use the updated model

### AC-11: Observability

- [ ] **AC-11.1:** All API requests produce OpenTelemetry traces with spans for database queries, LLM calls, and external API calls
- [ ] **AC-11.2:** Custom metric `prd_count_by_status` reports current counts for draft, in_review, approved, and submitted
- [ ] **AC-11.3:** Structured logs include trace IDs for correlation with distributed traces

### AC-12: Deployment

- [ ] **AC-12.1:** Application deploys to AWS EKS via Helm chart or Kustomize
- [ ] **AC-12.2:** Health check endpoint (`/healthz`) returns 200 when the service is ready
- [ ] **AC-12.3:** Horizontal Pod Autoscaler scales backend pods based on CPU/memory thresholds

---

## Phased Delivery Plan

### v1 (MVP)

| Feature | Requirements |
|---------|-------------|
| Agent chat (create-prd, refine-prd) | FR-3, FR-4, FR-9 |
| PRD dashboard, list, view, search | FR-5.1–FR-5.4 |
| Projects (add/edit/configure) | FR-2 |
| Tags/labels | FR-5.5 |
| Status workflow (Draft → In Review → Approved → Submitted) | FR-6.1–FR-6.6 |
| Document-level comments (threaded, resolvable) | FR-7 |
| Submission pipeline (Confluence, Jira Epic, Git PR, Beads) | FR-8 |
| Auth (OAuth/SSO) | FR-1 |
| Admin settings (global + per-project) | FR-11 |
| Version history | FR-5.4 |
| In-app notifications | FR-10 |
| Observability (OpenTelemetry tracing, logging, metrics) | NFR-14–NFR-17 |
| AWS EKS deployment | NFR-11, AC-12 |

### v2 (Follow-up)

| Feature | Requirements |
|---------|-------------|
| Version comparison (side-by-side diff) | FR-5 enhancement |
| Section-level inline comments | FR-7 enhancement |
| PDF export | FR-5.7 |
| Email notifications | FR-10 enhancement |
| Re-open submitted PRDs | FR-6.7 |
| Audit log UI | FR-11.5 |
| PRD archiving / deletion | Future FR |
| Analytics & reporting (PRDs created, avg time to approval) | Future FR |

---

## Open Questions

| # | Question | Impact | Status |
|---|----------|--------|--------|
| OQ-1 | **SSO Provider** — Which OAuth/SSO provider should we integrate with? (Google Workspace, Okta, Azure AD, etc.) | Affects authentication implementation | **Open** — decide before FR-1 implementation |
| OQ-2 | **Database Choice** — PostgreSQL on RDS/Aurora, or another managed service? | Affects infrastructure and cost | **Open** — decide before TRD |
| OQ-3 | **Frontend Framework** — React (Next.js), or another framework? | Affects frontend architecture | **Open** — decide before TRD |
| OQ-4 | **Confluence API Version** — Cloud REST API v2, or Server/Data Center API? | Affects integration code | **Open** — decide before FR-8 implementation |
| OQ-5 | **Git Hosting** — GitHub, GitLab, or Bitbucket? Which API? | Affects PR creation integration | **Open** — decide before FR-8 implementation |
| OQ-6 | **Session Storage for Scaling** — Pi SessionManager uses file-based storage by default. For horizontal scaling, do we need a shared session store (Redis, S3, EFS)? | Affects architecture for NFR-10 | **Open** — decide before TRD |
| OQ-7 | **Review-PRD Skill** — Should there be a separate AI-powered "review" step (agent critiques the PRD for completeness/quality) in addition to `refine-prd`? | Could improve PRD quality before human review | **Open** — decide before v2 |

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-26 | PRD Web Agent | Initial PRD — Full requirements for web-based PRD management agent with chat UI, document lifecycle, collaboration, and automated submission pipeline to Confluence/Jira/Git/Beads |
| 2.0 | 2026-02-26 | PRD Web Agent (Refined) | Stakeholder interview refinements: (1) All edits through agent only, no manual editing; (2) Reviewers auto-assigned per project, single approver; (3) Projects as first-class entity with add/edit/configure UI; (4) Flat list with tags/labels; (5) Integration settings: global defaults with per-project overrides; (6) Jira: always Epic with acceptance criteria, no custom fields; (7) No LLM token limits; (8) Re-open submitted PRDs for revisions (v2); (9) OpenTelemetry tracing, logging, metrics with custom PRD-by-status metrics; (10) No archiving/deletion for MVP; (11) Section-level comments deferred to v2; (12) PDF export (v2); (13) Phased delivery plan (v1/v2); (14) Resolved OQ-8 (no limits), OQ-9 (v2), OQ-10 (v2); (15) Added re-submission flow updating existing artifacts; (16) Added agent scoping for out-of-scope requests |
