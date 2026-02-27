# PRD: Adopt shadcn/ui Component Library

**Status:** Draft
**Author:** Product Team
**Date:** 2026-02-27
**Version:** 1.0

---

## 1. Product Summary

### Problem Statement

The PRD Web Agent application currently uses 33+ custom-built React components styled entirely with raw Tailwind CSS utility classes. This approach has led to:

- **High code duplication** — Button, input, badge, and modal patterns are repeated identically across 10+ components with no shared abstraction
- **Inconsistent styling** — Minor variations in colors, spacing, and focus states across similar elements (e.g., `focus:border-indigo-500` vs `focus:border-blue-500`)
- **No design system** — No CSS variables, design tokens, or centralized theme configuration; styling rules are implicit
- **Slow UI development** — Every new feature requires rebuilding common UI primitives from scratch
- **Limited accessibility** — Custom modals, dropdowns, and interactive elements lack robust keyboard navigation and ARIA patterns

### Proposed Solution

Adopt [shadcn/ui](https://ui.shadcn.com) as the project's component foundation. shadcn/ui is not a traditional npm dependency — it copies accessible, well-designed component source code directly into the project, giving full ownership and customization control. Components are built on Radix UI primitives (for accessibility) and styled with Tailwind CSS (matching our existing stack).

### Value Proposition

- **Eliminate duplication** — Replace 10+ repeated button/input/badge/modal implementations with shared, consistent primitives
- **Built-in accessibility** — Radix UI primitives provide keyboard navigation, focus management, and ARIA attributes out of the box
- **Theming via CSS variables** — Centralized color palette and design tokens enable dark mode and consistent styling
- **Faster feature development** — New pages and features compose from proven building blocks rather than starting from scratch
- **Zero lock-in** — Components live in our codebase (`src/components/ui/`), fully editable and removable

---

## 2. User Analysis

### Primary Users

| Persona | Role | Pain Point |
|---------|------|------------|
| **Product Manager** | Uses the web UI daily to create, refine, and review PRDs | Inconsistent UI patterns reduce confidence; accessibility gaps make navigation difficult |
| **Reviewer** | Reviews PRDs, leaves comments, approves/rejects | Comment threads, status badges, and modals lack polished interactions |
| **Admin** | Manages projects, users, and global settings | Admin pages need forms, tables, and dialogs that feel professional |
| **Developer** | Builds and maintains the frontend | Spends excessive time recreating common UI patterns; no shared component vocabulary |

### User Journey Impact

1. **Before**: Developer needs a confirmation dialog → writes 30+ lines of custom modal with overlay, focus trap, button variants, and close handling
2. **After**: Developer uses `<AlertDialog>` from shadcn/ui → 5 lines of composition with full accessibility built in

---

## 3. Goals & Non-Goals

### Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Initialize shadcn/ui in the project with theming | `npx shadcn init` completes; `components.json` and CSS variables configured |
| G2 | Install core primitive components | Button, Input, Textarea, Select, Badge, Card, Dialog, DropdownMenu, Table, Label, Separator, Sheet (mobile nav) available in `src/components/ui/` |
| G3 | Migrate existing components to use shadcn/ui primitives | All 33 components in `src/components/` refactored to compose from `src/components/ui/` primitives |
| G4 | Establish CSS variable-based theming | Tailwind config uses CSS variables for colors; globals.css defines light theme tokens |
| G5 | Maintain test coverage | All existing 624+ tests continue to pass after migration |
| G6 | Improve accessibility | All interactive components pass keyboard navigation and screen reader testing |

### Non-Goals

- **Dark mode** — CSS variable foundation will support it, but implementing a dark theme toggle is out of scope
- **New features** — This PRD covers migration only; no new pages or functionality
- **Component library publishing** — Components remain project-internal; no npm package
- **Visual redesign** — Maintain the current look and feel; shadcn/ui adoption is structural, not a rebrand
- **Replacing react-markdown** — The markdown rendering pipeline is unrelated and stays as-is

---

## 4. Functional Requirements

### FR1: Project Initialization

**Description:** Configure shadcn/ui in the project using the CLI.

**Details:**
- Run `npx shadcn init` targeting Next.js with App Router
- Configure `components.json` with:
  - Style: `default`
  - Base color: `slate` (closest to current gray palette)
  - CSS variables: enabled
  - Component path: `src/components/ui`
  - Utility path: `src/lib/utils.ts` (cn helper)
- Install required dependencies: `tailwind-merge`, `clsx`, `class-variance-authority`
- Add Radix UI packages as needed per component

**Acceptance Criteria:**
- [ ] `components.json` exists at project root
- [ ] `src/lib/utils.ts` exports a `cn()` utility function
- [ ] `globals.css` contains CSS variable definitions for the theme
- [ ] `tailwind.config.ts` references CSS variables for colors
- [ ] Project builds without errors (`npm run build`)

### FR2: Core Component Installation

**Description:** Install the shadcn/ui components that map to existing UI patterns.

**Component Mapping:**

| Current Pattern | shadcn/ui Component | Used In |
|----------------|---------------------|---------|
| Custom buttons (5+ variants) | `Button` | ProjectForm, TransitionButtons, CommentComposer, ErrorBanner, MessageComposer, SubmissionModal |
| `<input>` with Tailwind | `Input` | FilterBar, ProjectForm, SearchBar |
| `<textarea>` with Tailwind | `Textarea` | CommentComposer, MessageComposer, ProjectForm |
| `<select>` with Tailwind | `Select` | FilterBar, NewPrdPage |
| `<label>` with Tailwind | `Label` | ProjectForm, FilterBar |
| Status pills / tag pills | `Badge` | StatusBadge, TagPill, PrdListItem |
| Project cards | `Card` | ProjectCard |
| Custom modal overlays | `Dialog` / `AlertDialog` | SubmissionModal, TransitionButtons (confirmation) |
| Notification dropdown | `DropdownMenu` | NotificationBell, UserMenu |
| PRD list table | `Table` | Dashboard PrdListItem rows |
| Mobile nav drawer | `Sheet` | MobileMenuButton |
| Dividers | `Separator` | Various list components |
| Form composition | `Form` (react-hook-form) | ProjectForm, CommentComposer |

**Acceptance Criteria:**
- [ ] Each component listed above exists in `src/components/ui/`
- [ ] Components are importable and render without errors
- [ ] No unused Radix UI packages installed

### FR3: Component Migration

**Description:** Refactor existing feature components to compose from shadcn/ui primitives.

**Migration Priority (by impact):**

| Priority | Components | Rationale |
|----------|-----------|-----------|
| P0 — Highest | `Button` patterns across all components | Most duplicated pattern; affects every feature area |
| P0 | `Input`, `Textarea`, `Label`, `Select` in forms | Second most duplicated; 4+ forms use identical patterns |
| P1 | `Dialog` in SubmissionModal, TransitionButtons | Custom modals lack focus trapping and keyboard dismiss |
| P1 | `Badge` in StatusBadge, TagPill | Inconsistent color mapping across usages |
| P1 | `Card` in ProjectCard | Simple swap with better structure |
| P1 | `Table` in Dashboard | Formalizes table markup and styling |
| P2 | `DropdownMenu` in NotificationBell, UserMenu | Improves keyboard navigation |
| P2 | `Sheet` for mobile navigation | Replaces custom hamburger toggle with animated drawer |
| P3 | `Separator`, `Form` integration | Polish and optional improvements |

**Acceptance Criteria:**
- [ ] No raw `<button className="bg-blue-600...">` patterns remain outside `src/components/ui/`
- [ ] No raw `<input className="border border-gray-300...">` patterns remain outside `src/components/ui/`
- [ ] All modals use `Dialog` or `AlertDialog` with proper focus trapping
- [ ] All existing tests pass after each migration step

### FR4: Theming Configuration

**Description:** Establish a CSS variable-based theme that replaces hardcoded Tailwind colors.

**Details:**
- Define CSS variables in `globals.css` under `:root` for:
  - `--background`, `--foreground`
  - `--card`, `--card-foreground`
  - `--primary`, `--primary-foreground`
  - `--secondary`, `--secondary-foreground`
  - `--muted`, `--muted-foreground`
  - `--accent`, `--accent-foreground`
  - `--destructive`, `--destructive-foreground`
  - `--border`, `--input`, `--ring`
  - `--radius`
- Map current color usage:
  - `blue-600` → `--primary`
  - `gray-50/100` → `--muted`
  - `red-600` → `--destructive`
  - `gray-800` (nav) → `--card` or custom nav token
- Update `tailwind.config.ts` to reference CSS variables

**Acceptance Criteria:**
- [ ] All color references in migrated components use semantic tokens (e.g., `bg-primary` not `bg-blue-600`)
- [ ] Changing `--primary` in CSS updates all primary-colored elements
- [ ] `:root` CSS variables are defined in `globals.css`
- [ ] `tailwind.config.ts` maps Tailwind color names to CSS variables

---

## 5. Non-Functional Requirements

### NFR1: Performance

- **Bundle size**: Adding shadcn/ui should not increase the initial JS bundle by more than 50KB gzipped (Radix primitives are tree-shakeable)
- **Render performance**: No measurable regression in Lighthouse performance score

### NFR2: Accessibility

- All interactive shadcn/ui components must meet WCAG 2.1 AA:
  - Keyboard navigable (Tab, Enter, Escape, Arrow keys where applicable)
  - Proper ARIA roles, labels, and states
  - Focus visible indicators
  - Screen reader announcements for state changes (e.g., dialog open/close)

### NFR3: Developer Experience

- Components follow consistent import pattern: `import { Button } from "@/components/ui/button"`
- `cn()` utility available for conditional class merging
- No breaking changes to public component props during migration (feature components maintain their existing APIs)

### NFR4: Testing

- All 624+ existing tests must pass after migration
- New shadcn/ui primitive components do not require dedicated unit tests (they are tested through feature component tests)
- Migration PRs must not reduce overall test coverage

---

## 6. Technical Considerations

### Dependencies to Add

| Package | Purpose |
|---------|---------|
| `tailwind-merge` | Intelligent Tailwind class merging |
| `clsx` | Conditional className composition |
| `class-variance-authority` | Component variant management |
| `@radix-ui/react-dialog` | Dialog/AlertDialog primitive |
| `@radix-ui/react-dropdown-menu` | DropdownMenu primitive |
| `@radix-ui/react-select` | Select primitive |
| `@radix-ui/react-separator` | Separator primitive |
| `@radix-ui/react-slot` | Slot composition pattern |
| `@radix-ui/react-label` | Label primitive |
| `lucide-react` | Icon library — replaces all hand-coded inline SVGs |
| `react-hook-form` | Form state management for shadcn Form component |
| `@hookform/resolvers` | Zod resolver for react-hook-form validation |

### File Structure

```
src/
├── components/
│   ├── ui/                    # shadcn/ui primitives (NEW)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── select.tsx
│   │   ├── label.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── alert-dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── table.tsx
│   │   ├── sheet.tsx
│   │   ├── separator.tsx
│   │   └── form.tsx
│   ├── chat/                  # Existing (refactored to use ui/)
│   ├── comments/              # Existing (refactored to use ui/)
│   ├── dashboard/             # Existing (refactored to use ui/)
│   ├── nav/                   # Existing (refactored to use ui/)
│   ├── notifications/         # Existing (refactored to use ui/)
│   ├── prd/                   # Existing (refactored to use ui/)
│   ├── projects/              # Existing (refactored to use ui/)
│   ├── submission/            # Existing (refactored to use ui/)
│   └── workflow/              # Existing (refactored to use ui/)
├── lib/
│   └── utils.ts               # cn() helper (NEW)
```

### Migration Strategy

The migration will be completed in a **single sprint**, working incrementally — one component type at a time, with tests passing after each step:

1. **Phase 1: Foundation** — Init shadcn/ui, install `Button`, `Input`, `Textarea`, `Label`, `Badge`; add `lucide-react`; create `cn()` utility
2. **Phase 2: Forms** — Install shadcn `Form` component with `react-hook-form` + `zod`; migrate ProjectForm, FilterBar, CommentComposer, MessageComposer
3. **Phase 3: Icons** — Replace all hand-coded inline SVGs with `lucide-react` icon components across all feature components
4. **Phase 4: Dialogs** — Install `Dialog`/`AlertDialog`, migrate SubmissionModal and TransitionButtons
5. **Phase 5: Navigation** — Install `DropdownMenu`/`Sheet`, migrate NotificationBell, UserMenu, MobileMenu
6. **Phase 6: Data Display** — Install `Table`/`Card`, migrate Dashboard and ProjectCard
7. **Phase 7: Cleanup** — Remove orphaned raw Tailwind patterns, verify all inline SVGs replaced, final test pass

---

## 7. Acceptance Criteria Summary

| # | Criterion | Verification |
|---|-----------|-------------|
| AC1 | shadcn/ui initialized with `components.json` and CSS variables | File exists; `npm run build` succeeds |
| AC2 | 13+ shadcn/ui components installed in `src/components/ui/` | Directory listing confirms all components |
| AC3 | All 33 feature components refactored to use shadcn/ui primitives | Code review confirms no raw button/input/modal patterns outside `ui/` |
| AC4 | CSS variable theming configured | Changing `--primary` in devtools updates all primary elements |
| AC5 | All 624+ existing tests pass | `npm test` exits 0 with no failures |
| AC6 | No visual regression | Manual comparison of all pages before/after migration |
| AC7 | Keyboard navigation works on all interactive elements | Manual testing: Tab through forms, Escape closes dialogs, Arrow keys in menus |
| AC8 | Bundle size increase < 50KB gzipped | Lighthouse or `next build` analysis |

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Radix UI conflicts with existing event handlers | Medium | Migrate one component at a time; test after each |
| Test mocking complexity increases with Radix portals | Medium | Use `@testing-library/react` portal queries; update jest setup if needed |
| Visual differences after migration | Low | Compare screenshots before/after; match existing color values in CSS variables |
| Developer learning curve | Low | shadcn/ui patterns are well-documented; code lives in-project for easy reference |

---

## 9. Decisions

1. **Icons**: Adopt `lucide-react` for all icons. Replace all hand-coded inline SVGs with Lucide icon components.
2. **Forms**: Adopt `react-hook-form` + `zod` integration via shadcn's `Form` component for all forms.
3. **Timeline**: Single sprint — complete the full migration in one sprint.
