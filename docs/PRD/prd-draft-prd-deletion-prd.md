Here's the comprehensive PRD:

---

# PRD: Draft PRD Deletion

**Version:** 1.0
**Status:** Draft
**Date:** 2025-07-23
**Author:** PRD Specialist

---

## 1. Summary

Enable users to permanently delete Product Requirements Documents (PRDs) that are in **Draft** status. Currently, PRDs can be created and edited but not removed, leading to workspace clutter. This feature adds a safe, scoped deletion capability limited to Draft-mode documents, ensuring that approved or in-review PRDs remain protected from accidental removal.

---

## 2. Problem Statement

Users accumulate abandoned, duplicate, or experimental Draft PRDs over time with no way to clean them up. This creates several issues:

- **Discoverability degrades** — important drafts get lost among stale ones.
- **Cognitive overhead increases** — users must mentally filter irrelevant documents when browsing their PRD list.
- **No self-service cleanup** — without deletion, users depend on admins or workarounds (e.g., renaming documents to mark them as obsolete).

Limiting deletion to Draft status mitigates risk: documents that have progressed through review or approval workflows remain immutable and auditable.

---

## 3. User Analysis

| Persona | Need | Current Pain |
|---|---|---|
| **Product Manager** | Remove abandoned drafts to keep workspace organized | Scrolls past dozens of stale drafts to find active work |
| **Engineering Lead** | Confidence that approved PRDs cannot be deleted | No deletion exists today, but adding it without safeguards would create risk |
| **Project Admin** | Visibility into what was deleted and by whom | No audit trail for document lifecycle changes |

---

## 4. Goals & Non-Goals

### Goals

1. Allow a PRD owner to delete their own Draft-status PRDs.
2. Require explicit confirmation before deletion to prevent accidents.
3. Log all deletions for auditability.
4. Update the PRD list UI to reflect deletions immediately.

### Non-Goals

- **Bulk/mass deletion** — out of scope for v1; single-document delete only.
- **Soft-delete / trash / undo** — v1 is a hard delete; recoverability may be revisited later.
- **Deletion of non-Draft PRDs** — PRDs in Review, Approved, or Archived status are not deletable.
- **Admin override deletion** — admin-level deletion of any-status PRDs is a separate future feature.

---

## 5. Functional Requirements

### FR-1: Delete API Endpoint

| Attribute | Detail |
|---|---|
| **Method** | `DELETE` |
| **Path** | `/api/internal/prd/delete` |
| **Auth** | Bearer token (`OPENCLAW_INTERNAL_TOKEN`) |
| **Body** | `{ "identifier": "<prd-id>", "userId": "<requesting-user-id>" }` |
| **Preconditions** | PRD exists, status is `Draft`, requesting user is the PRD owner |
| **Success Response** | `200 OK` — `{ "deleted": true, "identifier": "..." }` |
| **Error Responses** | `404` — PRD not found · `403` — user is not the owner · `409` — PRD is not in Draft status |

**Acceptance Criteria:**
- A Draft PRD owned by the requesting user is permanently removed from storage upon a successful call.
- Attempting to delete a non-Draft PRD returns `409 Conflict` with a clear error message.
- Attempting to delete another user's PRD returns `403 Forbidden`.

### FR-2: Confirmation Dialog (UI)

- Clicking "Delete" on a Draft PRD opens a confirmation modal: *"Permanently delete '{title}'? This cannot be undone."*
- Modal has **Cancel** (default focus) and **Delete** (destructive style) buttons.
- Delete button is disabled for 1 second after the modal opens to prevent accidental double-clicks.

**Acceptance Criteria:**
- No deletion occurs without the user explicitly confirming via the modal.

### FR-3: PRD List Update

- After successful deletion, the PRD is removed from the list without a full page reload.
- A transient success toast is shown: *"'{title}' deleted."*

**Acceptance Criteria:**
- The deleted PRD no longer appears in list or search results immediately after deletion.

### FR-4: Delete Button Visibility

- A "Delete" action (icon or menu item) is visible **only** on PRDs where `status === 'Draft'` **and** the current user is the owner.
- The button is hidden (not just disabled) for non-Draft PRDs.

**Acceptance Criteria:**
- Non-owners and non-Draft PRDs never render a delete affordance.

### FR-5: Audit Log Entry

- Every deletion writes an audit record: `{ event: "prd.deleted", prdId, userId, title, timestamp }`.
- Audit records are queryable by project admins.

**Acceptance Criteria:**
- An audit entry exists for every successful deletion and includes all specified fields.

---

## 6. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| **NFR-1** | **Latency** | Delete API responds in < 500 ms (p95) |
| **NFR-2** | **Consistency** | Deletion is atomic — partial deletes must not leave orphaned data |
| **NFR-3** | **Authorization** | Endpoint enforces ownership + status checks server-side; UI hiding is defense-in-depth only |
| **NFR-4** | **Idempotency** | Calling delete on an already-deleted PRD returns `404`, not an error |
| **NFR-5** | **Accessibility** | Confirmation modal is keyboard-navigable and screen-reader announced |
| **NFR-6** | **Data Integrity** | Any references to the deleted PRD (e.g., links from other docs) gracefully show "Document not found" |

---

## 7. Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| **Adoption** | ≥ 30% of active users use deletion within 30 days of launch | Analytics event tracking |
| **Draft clutter reduction** | Average Draft PRDs per user decreases by ≥ 20% within 60 days | Before/after snapshot of PRD counts |
| **Error rate** | < 0.5% of delete attempts result in unexpected errors | Server error logs |
| **Accidental deletion complaints** | 0 support tickets for unintended deletions in first 90 days | Support ticket tracking |
| **Latency** | p95 delete response < 500 ms | APM monitoring |

---

*End of PRD.*