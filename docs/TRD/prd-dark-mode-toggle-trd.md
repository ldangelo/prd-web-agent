# TRD: Dark Mode Toggle

**Version:** 1.0
**Date:** 2026-03-02
**Status:** Draft
**PRD Reference:** [docs/PRD/prd-dark-mode-toggle-prd.md](../PRD/prd-dark-mode-toggle-prd.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Master Task List](#master-task-list)
3. [System Architecture](#system-architecture)
4. [Technical Design](#technical-design)
5. [Data Flow](#data-flow)
6. [Integration Points](#integration-points)
7. [Sprint Planning](#sprint-planning)
8. [Acceptance Criteria](#acceptance-criteria)
9. [Quality Requirements](#quality-requirements)
10. [Testing Strategy](#testing-strategy)

---

## Overview

This TRD translates the Dark Mode Toggle PRD into concrete technical tasks, architecture decisions, and implementation specifications for the **prd-web-agent** Next.js 14 application.

### Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Dark mode strategy | `darkMode: ["class"]` | Already configured in `tailwind.config.ts`; class-based allows JS control |
| Theme state | React Context + `useReducer` | Lightweight; no external store needed |
| CSS tokens | CSS custom properties in `globals.css` | `:root` and `.dark` blocks already present |
| Server persistence | New API route + `User.themePreference` field | Mirrors `UserLlmSettings` pattern |
| FOUC prevention | Inline `<script>` in `layout.tsx` | Runs before React hydration |
| localStorage key | `"theme-preference"` | Consistent naming |

---

## Master Task List

### Phase 1 — Design Tokens & CSS Foundation

- [ ] **T-001** Audit all hard-coded color classes in components and document token gaps *(1h)*
- [ ] **T-002** Extend `:root` and `.dark` blocks in `globals.css` with nav and code-block tokens *(1h)*
- [ ] **T-003** Add CSS transition rule for theme switching on `html` element *(0.5h)*

### Phase 2 — Database Schema

- [ ] **T-004** Add `ThemePreference` enum to `prisma/schema.prisma` *(0.5h)*
- [ ] **T-005** Add `themePreference` field to `User` model *(0.5h)*
- [ ] **T-006** Generate and run Prisma migration *(0.5h)*

### Phase 3 — Theme API

- [ ] **T-007** Create `src/app/api/user/theme/route.ts` with `GET` and `PUT` handlers *(2h)*
- [ ] **T-008** Write Jest/node tests for the theme API route *(2h)* — depends: T-007

### Phase 4 — ThemeProvider Context

- [ ] **T-009** Create `src/components/theme/ThemeProvider.tsx` with context, `useTheme()` hook, and `matchMedia` listener *(3h)*
- [ ] **T-010** Create `src/components/theme/ThemeSync.tsx` server-preference sync component *(1.5h)* — depends: T-009, T-007
- [ ] **T-011** Write Jest/jsdom tests for `ThemeProvider` (14 test cases) *(2h)* — depends: T-009

### Phase 5 — FOUC Prevention

- [ ] **T-012** Add inline `<script>` to `src/app/layout.tsx` for pre-hydration theme application *(1h)*
- [ ] **T-013** Wrap body with `<ThemeProvider>` and add `<ThemeSync>` *(0.5h)* — depends: T-009, T-010, T-012

### Phase 6 — ThemeToggle Component

- [ ] **T-014** Create `src/components/theme/ThemeToggle.tsx` with Light/Dark/System radiogroup *(2h)* — depends: T-009
- [ ] **T-015** Write Jest/jsdom tests for `ThemeToggle` (8 test cases) *(1.5h)* — depends: T-014
- [ ] **T-016** Add `ThemeToggle` to `src/components/nav/NavBar.tsx` *(1h)* — depends: T-014

### Phase 7 — Component Token Migration

- [ ] **T-017** Migrate `src/components/nav/NavBar.tsx` from hard-coded to token classes *(1h)*
- [ ] **T-018** Migrate `src/components/nav/UserMenu.tsx` from hard-coded to token classes *(1h)*
- [ ] **T-019** Migrate `src/components/nav/MobileNav.tsx` from hard-coded to token classes *(1h)*
- [ ] **T-020** Migrate `src/app/settings/page.tsx` from hard-coded to token classes *(0.5h)*
- [ ] **T-021** Audit and migrate remaining components (cards, modals, tables, buttons, inputs, dropdowns) *(4h)*
- [ ] **T-022** Apply dark-appropriate syntax highlighting palette to code blocks *(1h)*

### Phase 8 — Testing & Quality Gates

- [ ] **T-023** Write Playwright E2E tests (7 scenarios) for dark mode flows *(3h)* — depends: T-013, T-016
- [ ] **T-024** Run Lighthouse / axe accessibility audits in both themes on all key pages *(2h)*
- [ ] **T-025** Verify CSS bundle size increase is <= 15 KB gzipped *(0.5h)*
- [ ] **T-026** Verify theme switch interaction latency < 50 ms *(0.5h)*
- [ ] **T-027** Cross-browser testing matrix (Chrome, Firefox, Safari, Edge, iOS Safari) *(2h)*
- [ ] **T-028** Run full Jest suite and confirm no regressions *(0.5h)*

### Phase 9 — Checkpoints

- [ ] **T-029** Checkpoint: Code review of Phase 1-5 *(1h)*
- [ ] **T-030** Checkpoint: Code review of Phase 6-8 *(1h)*

**Total estimated effort:** ~38 hours

---

## System Architecture

```
layout.tsx
  [inline FOUC script]
    reads localStorage["theme-preference"]
    applies .dark to <html> before React hydration
  <ThemeProvider>
    ThemeContext { preference, resolved, setPreference }
    useTheme() hook
    matchMedia listener (OS preference changes)
    <ThemeSync>
      GET /api/user/theme on mount (authenticated users)
    <NavBar>
      <ThemeToggle role="radiogroup">
        [Light] [Dark] [System]
        onClick -> setPreference()

setPreference(pref):
  1. dispatch -> update context state -> applyTheme()
  2. localStorage.setItem("theme-preference", pref)
  3. PUT /api/user/theme (fails silently if unauthenticated)
```

---

## Technical Design

### 1. CSS Custom Properties (T-002)

Extend `src/app/globals.css`:

```css
@layer base {
  :root {
    --nav-background: 31 41 55;
    --nav-foreground: 255 255 255;
    --nav-item-hover: 55 65 81;
    --nav-item-active: 75 85 99;
    --code-background: 243 244 246;
    --code-foreground: 17 24 39;
    --code-border: 229 231 235;
  }
  .dark {
    --nav-background: 15 23 42;
    --nav-foreground: 248 250 252;
    --nav-item-hover: 30 41 59;
    --nav-item-active: 51 65 85;
    --code-background: 30 41 59;
    --code-foreground: 226 232 240;
    --code-border: 51 65 85;
  }
}

html {
  transition: background-color 150ms ease, color 150ms ease;
}
```

### 2. Tailwind Configuration

`tailwind.config.ts` already has `darkMode: ["class"]` — **no changes required**.

### 3. Prisma Schema Changes (T-004, T-005)

```prisma
enum ThemePreference {
  LIGHT
  DARK
  SYSTEM
}

model User {
  // ... existing fields ...
  themePreference ThemePreference @default(SYSTEM)
}
```

Migration SQL:
```sql
CREATE TYPE "ThemePreference" AS ENUM ("LIGHT", "DARK", "SYSTEM");
ALTER TABLE "User" ADD COLUMN "themePreference" "ThemePreference" NOT NULL DEFAULT "SYSTEM";
```

### 4. Theme API Route (T-007)

**File:** `src/app/api/user/theme/route.ts`

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ThemePreference } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { themePreference: true },
  });
  return NextResponse.json({ themePreference: user?.themePreference ?? "SYSTEM" });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { themePreference } = await request.json();
  if (!Object.values(ThemePreference).includes(themePreference))
    return NextResponse.json({ error: "Invalid theme preference" }, { status: 400 });
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { themePreference },
    select: { themePreference: true },
  });
  return NextResponse.json({ themePreference: user.themePreference });
}
```

### 5. ThemeProvider (T-009)

**File:** `src/components/theme/ThemeProvider.tsx`

```typescript
"use client";
import { createContext, useContext, useEffect, useReducer, useCallback } from "react";

export type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "theme-preference";

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "SYSTEM")
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return pref === "DARK" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const stored = typeof window !== "undefined"
    ? (localStorage.getItem(STORAGE_KEY) as ThemePreference | null) : null;
  const init = stored ?? "SYSTEM";
  const [state, dispatch] = useReducer(
    (s: { preference: ThemePreference; resolved: ResolvedTheme }, a: any) => {
      if (a.type === "SET") return { preference: a.pref, resolved: resolveTheme(a.pref) };
      if (a.type === "OS" && s.preference === "SYSTEM") return { ...s, resolved: a.resolved };
      return s;
    },
    { preference: init, resolved: resolveTheme(init) }
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.resolved === "dark");
  }, [state.resolved]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = (e: MediaQueryListEvent) =>
      dispatch({ type: "OS", resolved: e.matches ? "dark" : "light" });
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  const setPreference = useCallback(async (pref: ThemePreference) => {
    dispatch({ type: "SET", pref });
    localStorage.setItem(STORAGE_KEY, pref);
    try {
      await fetch("/api/user/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreference: pref }),
      });
    } catch {}
  }, []);
  return <ThemeContext.Provider value={{ ...state, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

### 6. ThemeSync (T-010)

**File:** `src/components/theme/ThemeSync.tsx`

```typescript
"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTheme, ThemePreference } from "./ThemeProvider";

export function ThemeSync() {
  const { data: session } = useSession();
  const { setPreference } = useTheme();
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/user/theme")
      .then((r) => r.json())
      .then(({ themePreference }: { themePreference: ThemePreference }) =>
        setPreference(themePreference))
      .catch(() => {});
  }, [session?.user?.id]);
  return null;
}
```

### 7. FOUC Prevention (T-012, T-013)

Add to `src/app/layout.tsx`:

```tsx
const themeScript = `(function(){try{var p=localStorage.getItem("theme-preference");var d=p==="DARK"||((!p||p==="SYSTEM")&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

<html lang="en" suppressHydrationWarning>
  <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
  <body><ThemeProvider><ThemeSync />{/* rest */}</ThemeProvider></body>
</html>
```

### 8. ThemeToggle Component (T-014)

**File:** `src/components/theme/ThemeToggle.tsx`

```typescript
"use client";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, ThemePreference } from "./ThemeProvider";

const OPTIONS = [
  { value: "LIGHT" as ThemePreference, label: "Light", Icon: Sun },
  { value: "DARK"  as ThemePreference, label: "Dark",  Icon: Moon },
  { value: "SYSTEM" as ThemePreference, label: "System", Icon: Monitor },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <div role="radiogroup" aria-label="Color theme" className="flex items-center gap-1">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button key={value} role="radio" aria-checked={preference === value}
          aria-label={label} onClick={() => setPreference(value)}
          className={`p-2 rounded-md transition-colors ${preference === value
            ? "bg-[rgb(var(--nav-item-active))] text-white"
            : "text-[rgb(var(--nav-foreground))] hover:bg-[rgb(var(--nav-item-hover))]"}`}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
```

### 9. localStorage Fallback Strategy

| Scenario | Behavior |
|---|---|
| First visit, no session | matchMedia -> SYSTEM applied |
| First visit, authenticated | GET /api/user/theme via ThemeSync |
| Return visit, localStorage=DARK | FOUC script applies .dark immediately |
| Return visit, authenticated | ThemeSync syncs server preference |
| Toggle, authenticated | localStorage + PUT /api/user/theme |
| Toggle, unauthenticated | localStorage only; API fails silently |
| New device, authenticated | ThemeSync fetches server preference |
| OS change, SYSTEM mode | matchMedia listener; no reload |

---

## Data Flow

### Page Load (Authenticated)
```
1. Page request -> layout.tsx rendered
2. FOUC inline script: reads localStorage, applies .dark if needed
3. React hydrates -> ThemeProvider mounts
4. ThemeSync: GET /api/user/theme -> DB -> setPreference(serverValue)
```

### User Toggle
```
ThemeToggle click -> setPreference("DARK")
  dispatch SET -> resolved="dark" -> classList.add("dark") [<=200ms]
  localStorage.setItem("theme-preference", "DARK")
  PUT /api/user/theme -> UPDATE User SET themePreference = DARK
```

### OS Preference Change (SYSTEM mode)
```
OS dark mode -> matchMedia "change" event
  dispatch OS_CHANGE { resolved: "dark" } -> classList.add("dark")
  [No reload, no API call]
```

---

## Integration Points

| File | Change Type | Tasks |
|---|---|---|
| `src/app/globals.css` | Extend CSS tokens + transition | T-002, T-003 |
| `tailwind.config.ts` | No change needed | -- |
| `prisma/schema.prisma` | Add enum + User field | T-004, T-005 |
| `prisma/migrations/` | New migration | T-006 |
| `src/app/api/user/theme/route.ts` | **New file** | T-007 |
| `src/app/api/user/theme/__tests__/route.test.ts` | **New file** | T-008 |
| `src/components/theme/ThemeProvider.tsx` | **New file** | T-009 |
| `src/components/theme/ThemeSync.tsx` | **New file** | T-010 |
| `src/components/theme/__tests__/ThemeProvider.test.tsx` | **New file** | T-011 |
| `src/app/layout.tsx` | FOUC script + ThemeProvider wrap | T-012, T-013 |
| `src/components/theme/ThemeToggle.tsx` | **New file** | T-014 |
| `src/components/theme/__tests__/ThemeToggle.test.tsx` | **New file** | T-015 |
| `src/components/nav/NavBar.tsx` | ThemeToggle + token migration | T-016, T-017 |
| `src/components/nav/UserMenu.tsx` | Token migration | T-018 |
| `src/components/nav/MobileNav.tsx` | Token migration | T-019 |
| `src/app/settings/page.tsx` | Token migration | T-020 |
| All other components | Token migration | T-021, T-022 |
| `e2e/dark-mode.spec.ts` | **New file** | T-023 |

---

## Sprint Planning

### Sprint 1 — Foundation (Days 1-4, ~14h)
Goal: Tokens, schema, API, ThemeProvider. No visible UI changes.

| Day | Tasks | Effort |
|---|---|---|
| 1 | T-001, T-002, T-003 | 2.5h |
| 2 | T-004, T-005, T-006, T-007 | 3.5h |
| 3 | T-008, T-009 | 5h |
| 4 | T-011, T-029 | 3h |

Exit criteria:
- [ ] CSS tokens defined
- [ ] Prisma migration applied in dev
- [ ] GET/PUT /api/user/theme working
- [ ] ThemeProvider tests green

### Sprint 2 — UI Integration (Days 5-8, ~14h)
Goal: FOUC prevention + ThemeToggle + nav migration.

| Day | Tasks | Effort |
|---|---|---|
| 5 | T-010, T-012, T-013 | 3h |
| 6 | T-014, T-015, T-016 | 4.5h |
| 7 | T-017, T-018, T-019, T-020 | 3.5h |
| 8 | T-021, T-022 | 5h |

Exit criteria:
- [ ] No FOUC on page load
- [ ] ThemeToggle in NavBar, all 3 states functional
- [ ] Nav components on token classes

### Sprint 3 — Quality & Hardening (Days 9-12, ~10h)
Goal: E2E, a11y, perf, cross-browser.

| Day | Tasks | Effort |
|---|---|---|
| 9 | T-023 | 3h |
| 10 | T-024, T-025, T-026 | 3h |
| 11 | T-027 | 2h |
| 12 | T-028, T-030 | 2h |

Exit criteria:
- [ ] All 7 Playwright scenarios passing
- [ ] WCAG 2.1 AA verified
- [ ] CSS delta <= 15 KB gzipped
- [ ] Full Jest suite green

---

## Acceptance Criteria

- [ ] **AC-001** ThemeToggle visible in header on all pages
- [ ] **AC-002** Theme applies within <= 200 ms without page reload
- [ ] **AC-003** System mode matches OS dark mode setting
- [ ] **AC-004** OS changes update UI in real time (no reload)
- [ ] **AC-005** Authenticated preference persisted server-side, synced cross-device
- [ ] **AC-006** Unauthenticated preference stored in localStorage, restored on return
- [ ] **AC-007** All UI surfaces correct in dark mode
- [ ] **AC-008** No FOUC on initial page load
- [ ] **AC-009** Both themes pass WCAG 2.1 AA contrast requirements
- [ ] **AC-010** CSS bundle delta <= 15 KB gzipped; theme switch < 50 ms

---

## Quality Requirements

### Security
- Theme API requires session (401 otherwise)
- localStorage stores only non-sensitive preference string
- FOUC script: no eval, no external fetches

### Performance

| Metric | Target | Verification |
|---|---|---|
| Theme switch latency | < 50 ms | Chrome DevTools |
| CSS bundle delta | <= 15 KB gzipped | next build analyzer |
| LCP regression | 0 regressions > 50ms p95 | Lighthouse CI |
| API response | < 200 ms p95 | OpenTelemetry |

### Accessibility

| Requirement | Standard | Test |
|---|---|---|
| Normal text contrast | >= 4.5:1 WCAG 2.1 AA | axe / Lighthouse |
| Large text contrast | >= 3:1 WCAG 2.1 AA | axe / Lighthouse |
| Toggle keyboard access | Tab + Space/Enter | Playwright |
| Toggle ARIA | role=radiogroup, aria-checked | axe |

### Browser Compatibility
Chrome (latest 2), Firefox (latest 2), Safari (latest 2), Edge (latest 2), iOS Safari 15+, Android Chrome (latest)

### Maintainability
- All colors via CSS custom properties; no per-component dark: duplication
- useTheme() is single access point for theme state
- New components only need token classes (bg-background, text-foreground, etc.)

---

## Testing Strategy

### Jest — ThemeProvider (src/components/theme/__tests__/ThemeProvider.test.tsx, jsdom)

```typescript
describe("ThemeProvider", () => {
  it("defaults to SYSTEM preference");
  it("resolves SYSTEM to dark when OS is dark");
  it("resolves SYSTEM to light when OS is light");
  it("setPreference(DARK) adds .dark to html element");
  it("setPreference(LIGHT) removes .dark from html element");
  it("setPreference persists to localStorage");
  it("restores preference from localStorage on mount");
  it("fires PUT /api/user/theme");
  it("silently ignores API error when unauthenticated");
  it("OS change updates resolved theme when SYSTEM");
  it("OS change is ignored when preference is not SYSTEM");
  it("removes matchMedia listener on unmount");
  it("useTheme throws when used outside ThemeProvider");
  it("resolved theme reflects actual applied theme for SYSTEM mode");
});
```

### Jest — ThemeToggle (src/components/theme/__tests__/ThemeToggle.test.tsx, jsdom)

```typescript
describe("ThemeToggle", () => {
  it("renders three option buttons");
  it("marks current preference as aria-checked=true");
  it("clicking DARK calls setPreference(DARK)");
  it("clicking LIGHT calls setPreference(LIGHT)");
  it("clicking SYSTEM calls setPreference(SYSTEM)");
  it("is keyboard accessible via Space key");
  it("each button has aria-label");
  it("container has role=radiogroup");
});
```

### Jest — API Route (src/app/api/user/theme/__tests__/route.test.ts, node)

```typescript
describe("GET /api/user/theme", () => {
  it("returns 401 when unauthenticated");
  it("returns stored themePreference for authenticated user");
  it("returns SYSTEM when no preference set");
});

describe("PUT /api/user/theme", () => {
  it("returns 401 when unauthenticated");
  it("returns 400 for invalid preference value");
  it("updates preference to LIGHT");
  it("updates preference to DARK");
  it("updates preference to SYSTEM");
  it("returns updated preference in response");
  it("rejects missing themePreference field");
  it("rejects unknown enum values");
});
```

### Playwright E2E (e2e/dark-mode.spec.ts)

```typescript
test("defaults to system preference on first visit");
test("toggle to Dark applies .dark class immediately");
test("toggle to Light removes .dark class immediately");
test("System mode follows OS preference change in real time");
test("preference persists in localStorage after toggle");
test("authenticated user preference synced across page reload");
test("no FOUC on page load with dark preference in localStorage");
```

---

*Skill used: **jest** — applied for __tests__/ directory conventions, jsdom vs node environment selection per jest.config.ts, ts-jest patterns, and TDD test case structure.*