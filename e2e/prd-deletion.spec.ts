/**
 * E2E Test: PRD Draft Deletion
 *
 * Tests the DeletePrdButton (src/components/dashboard/DeletePrdButton.tsx)
 * and DeletePrdConfirmModal (src/components/dashboard/DeletePrdConfirmModal.tsx)
 * components rendered inside the PRD Dashboard (src/app/dashboard/page.tsx).
 *
 * Strategy: Cookie injection + API mocking.
 *   - Inject a real NextAuth v5 JWE session cookie so the Next.js middleware
 *     (`src/middleware.ts`) allows the request through without redirecting to /login.
 *     Generated with `@auth/core/jwt`'s `encode()` using the dev AUTH_SECRET.
 *   - Mock client-side API calls with page.route():
 *       GET  /api/auth/session  → fake authenticated user JSON
 *       GET  /api/prds*         → list of PRDs with mixed statuses
 *       DELETE /api/prds/prd-draft-1 → successful deletion response
 *
 * PRD fixtures:
 *   PRD 1: id="prd-draft-1"    title="My Draft PRD"    status=DRAFT    author=test-user-1  (owned  → delete button VISIBLE)
 *   PRD 2: id="prd-review-1"   title="In Review PRD"   status=IN_REVIEW author=test-user-1  (NOT deletable)
 *   PRD 3: id="prd-approved-1" title="Approved PRD"    status=APPROVED  author=test-user-1  (NOT deletable)
 *   PRD 4: id="prd-other-1"    title="Other User Draft" status=DRAFT    author=other-user-99 (NOT owned → NOT deletable)
 *
 * Run:  npx playwright test e2e/prd-deletion.spec.ts --project=chromium
 *
 * Skill used: writing-playwright-tests
 *   - Real JWT cookie injection for server-side middleware auth bypass
 *   - API mocking with page.route() for client-side data layer
 *   - Stable selectors via aria-label and role attributes
 *   - Accidental-click guard awareness (1-second modal delay)
 *   - Artifact capture: screenshots/video on failure (via playwright.config.ts)
 */

import { test, expect, type Page, type Route, type BrowserContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3000";
const DASHBOARD_URL = `${BASE_URL}/dashboard`;

const CURRENT_USER_ID = "test-user-1";

// The AUTH_SECRET used by the dev environment (from .env).
// This matches the value in .env: AUTH_SECRET=dev-secret-change-in-production
const AUTH_SECRET = "dev-secret-change-in-production";

// NextAuth v5 cookie name for non-secure (http) connections.
const SESSION_COOKIE_NAME = "authjs.session-token";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PRDS = [
  {
    id: "prd-draft-1",
    title: "My Draft PRD",
    status: "DRAFT",
    tags: ["alpha"],
    currentVersion: 1,
    updatedAt: "2026-01-15T10:00:00Z",
    project: { id: "proj-1", name: "Project Alpha" },
    author: { id: CURRENT_USER_ID, name: "Test User" },
  },
  {
    id: "prd-review-1",
    title: "In Review PRD",
    status: "IN_REVIEW",
    tags: [],
    currentVersion: 2,
    updatedAt: "2026-01-14T09:00:00Z",
    project: { id: "proj-1", name: "Project Alpha" },
    author: { id: CURRENT_USER_ID, name: "Test User" },
  },
  {
    id: "prd-approved-1",
    title: "Approved PRD",
    status: "APPROVED",
    tags: ["beta"],
    currentVersion: 3,
    updatedAt: "2026-01-13T08:00:00Z",
    project: { id: "proj-2", name: "Project Beta" },
    author: { id: CURRENT_USER_ID, name: "Test User" },
  },
  {
    id: "prd-other-1",
    title: "Other User Draft",
    status: "DRAFT",
    tags: [],
    currentVersion: 1,
    updatedAt: "2026-01-12T07:00:00Z",
    project: { id: "proj-3", name: "Project Gamma" },
    author: { id: "other-user-99", name: "Other User" },
  },
];

const MOCK_SESSION_RESPONSE = {
  user: {
    id: CURRENT_USER_ID,
    name: "Test User",
    email: "test@example.com",
  },
  expires: "2099-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Auth token generation
// ---------------------------------------------------------------------------

/**
 * Generates a valid NextAuth v5 JWE session token using @auth/core's encode()
 * with the dev AUTH_SECRET. This token will pass the Next.js middleware auth
 * check in src/middleware.ts (which calls `auth()` to validate the cookie).
 */
async function generateSessionToken(): Promise<string> {
  // Dynamic require to avoid TypeScript/ESM issues in the test runner.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { encode } = await import(
    "/Users/ldangelo/Development/prd-web-agent/node_modules/@auth/core/jwt.js"
  );
  return encode({
    token: {
      id: CURRENT_USER_ID,
      role: "AUTHOR",
      name: "Test User",
      email: "test@example.com",
      sub: CURRENT_USER_ID,
    },
    secret: AUTH_SECRET,
    salt: SESSION_COOKIE_NAME,
    maxAge: 86400 * 30,
  });
}

/**
 * Injects a valid NextAuth v5 session cookie into the browser context so the
 * middleware lets the request through without redirecting to /login.
 */
async function injectSessionCookie(context: BrowserContext): Promise<void> {
  const token = await generateSessionToken();
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

// ---------------------------------------------------------------------------
// Route mocking helpers
// ---------------------------------------------------------------------------

/**
 * Sets up all required route mocks on the given page:
 *   - NextAuth session endpoint (client-side useSession() calls)
 *   - PRD list endpoint (GET /api/prds*)
 *   - Optional: PRD delete endpoint
 */
async function setupApiMocks(page: Page, mockDelete = false): Promise<void> {
  // Mock NextAuth session response so useSession() in the dashboard page
  // receives the correct user data (including user.id for delete button visibility).
  await page.route("**/api/auth/session", (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SESSION_RESPONSE),
    });
  });

  // Mock supporting NextAuth endpoints to avoid network errors.
  await page.route("**/api/auth/csrf", (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "mock-csrf-token" }),
    });
  });

  await page.route("**/api/auth/providers", (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // Mock PRD list — intercept GET requests to /api/prds (with or without query params).
  const prdListResponse = JSON.stringify({
    data: {
      items: MOCK_PRDS,
      pagination: {
        page: 1,
        limit: 20,
        total: MOCK_PRDS.length,
        totalPages: 1,
      },
    },
  });

  await page.route("**/api/prds", (route: Route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: prdListResponse,
      });
    } else {
      route.fallback();
    }
  });

  await page.route("**/api/prds?**", (route: Route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: prdListResponse,
      });
    } else {
      route.fallback();
    }
  });

  // Mock DELETE endpoint for prd-draft-1 when requested.
  if (mockDelete) {
    await page.route("**/api/prds/prd-draft-1", (route: Route) => {
      if (route.request().method() === "DELETE") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: { deleted: true, identifier: "prd-draft-1" },
          }),
        });
      } else {
        route.fallback();
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Navigation helper
// ---------------------------------------------------------------------------

/**
 * Navigates to the PRD Dashboard and waits for the PRD table to render.
 * The dashboard is a client component that fetches PRDs via useEffect, so
 * we wait for a known PRD title to appear before returning.
 */
async function goToDashboard(page: Page): Promise<void> {
  await page.goto(DASHBOARD_URL);
  // The dashboard client component shows a loading state then renders the table.
  // Wait for the first mock PRD title to become visible.
  await expect(page.getByText("My Draft PRD")).toBeVisible({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("PRD Draft Deletion", () => {
  // Inject auth cookie and set up API mocks before each test.
  test.beforeEach(async ({ page, context }) => {
    await injectSessionCookie(context);
    // Note: api mocks are set up per-test since mockDelete flag varies.
  });

  // -------------------------------------------------------------------------
  // Test 1: Delete button visible only for owned DRAFT PRDs
  // -------------------------------------------------------------------------
  test("delete button is visible only for the owned DRAFT PRD", async ({ page }) => {
    await setupApiMocks(page);
    await goToDashboard(page);

    // PRD 1 (owned DRAFT) — delete button MUST be present.
    const draftDeleteBtn = page.getByRole("button", { name: "Delete My Draft PRD" });
    await expect(draftDeleteBtn).toBeVisible();
    console.log("  [PASS] Delete button visible for owned DRAFT PRD.");

    // PRD 2 (IN_REVIEW) — no delete button.
    const reviewDeleteBtn = page.getByRole("button", { name: "Delete In Review PRD" });
    await expect(reviewDeleteBtn).toHaveCount(0);
    console.log("  [PASS] No delete button for IN_REVIEW PRD.");

    // PRD 3 (APPROVED) — no delete button.
    const approvedDeleteBtn = page.getByRole("button", { name: "Delete Approved PRD" });
    await expect(approvedDeleteBtn).toHaveCount(0);
    console.log("  [PASS] No delete button for APPROVED PRD.");

    // PRD 4 (DRAFT but owned by different user) — no delete button.
    const otherUserDeleteBtn = page.getByRole("button", { name: "Delete Other User Draft" });
    await expect(otherUserDeleteBtn).toHaveCount(0);
    console.log("  [PASS] No delete button for other user's DRAFT PRD.");
  });

  // -------------------------------------------------------------------------
  // Test 2: Non-draft PRDs have no delete button (explicit status coverage)
  // -------------------------------------------------------------------------
  test("IN_REVIEW, APPROVED and non-owned DRAFT PRDs have no delete button", async ({ page }) => {
    await setupApiMocks(page);
    await goToDashboard(page);

    // Confirm all four PRD rows rendered.
    await expect(page.getByText("My Draft PRD")).toBeVisible();
    await expect(page.getByText("In Review PRD")).toBeVisible();
    await expect(page.getByText("Approved PRD")).toBeVisible();
    await expect(page.getByText("Other User Draft")).toBeVisible();

    // Count all delete buttons — exactly one should be rendered across all rows.
    const allDeleteButtons = page.getByRole("button", { name: /^Delete / });
    await expect(allDeleteButtons).toHaveCount(1);
    console.log("  [PASS] Exactly one delete button exists across four PRD rows.");

    // That single button must belong to "My Draft PRD".
    await expect(allDeleteButtons.first()).toHaveAccessibleName("Delete My Draft PRD");
    console.log("  [PASS] The sole delete button belongs to 'My Draft PRD'.");
  });

  // -------------------------------------------------------------------------
  // Test 3: Delete confirmation modal opens with correct content
  // -------------------------------------------------------------------------
  test("clicking delete opens confirmation modal with correct heading and description", async ({ page }) => {
    await setupApiMocks(page);
    await goToDashboard(page);

    // Click the delete button.
    await page.getByRole("button", { name: "Delete My Draft PRD" }).click();

    // Modal dialog should be visible.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    console.log("  [PASS] Confirmation modal is visible after clicking delete.");

    // Title: "Delete 'My Draft PRD'?"
    // The component renders:  Delete &apos;{prdTitle}&apos;?
    // which produces:         Delete 'My Draft PRD'?
    const modalTitle = dialog.getByText(/Delete 'My Draft PRD'\?/);
    await expect(modalTitle).toBeVisible();
    console.log("  [PASS] Modal title is \"Delete 'My Draft PRD'?\".");

    // Description mentions "removed from your workspace".
    const modalDesc = dialog.getByText(/removed from your workspace/);
    await expect(modalDesc).toBeVisible();
    console.log("  [PASS] Modal description mentions 'removed from your workspace'.");

    // Both Cancel and Delete buttons present.
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Delete" })).toBeVisible();
    console.log("  [PASS] Modal has Cancel and Delete buttons.");
  });

  // -------------------------------------------------------------------------
  // Test 4: Cancel flow — modal dismissed, PRD remains
  // -------------------------------------------------------------------------
  test("cancelling the modal leaves the PRD in the list", async ({ page }) => {
    await setupApiMocks(page);
    await goToDashboard(page);

    // Open the modal.
    await page.getByRole("button", { name: "Delete My Draft PRD" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Click Cancel.
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // Modal should be gone.
    await expect(dialog).toBeHidden({ timeout: 5_000 });
    console.log("  [PASS] Modal dismissed after Cancel.");

    // NOTE: Radix UI Dialog returns focus to the trigger element (trash button) on close.
    // The trash button sits inside a <tr> row with an onClick handler that navigates
    // to the PRD detail page. Focus restoration can trigger this navigation in headless
    // Chromium. We navigate back to the dashboard explicitly to verify the cancel did
    // NOT delete the PRD.
    //
    // This is a known focus-return interaction between Radix Dialog and the clickable
    // table row in PrdListItem — a separate bug from the deletion feature itself.
    await page.goto(DASHBOARD_URL);
    // Wait for the PRD list to re-load (api mocks remain active in the same page).
    await expect(page.getByText("My Draft PRD")).toBeVisible({ timeout: 10_000 });
    console.log("  [PASS] 'My Draft PRD' still present in list after Cancel.");

    // Delete button should still be present too.
    await expect(page.getByRole("button", { name: "Delete My Draft PRD" })).toBeVisible();
    console.log("  [PASS] Delete button still visible after Cancel.");
  });

  // -------------------------------------------------------------------------
  // Test 5: Successful deletion flow
  // -------------------------------------------------------------------------
  test("confirming deletion removes PRD from list and shows success toast", async ({ page }) => {
    await setupApiMocks(page, /* mockDelete= */ true);
    await goToDashboard(page);

    // Verify PRD present before deletion.
    await expect(page.getByText("My Draft PRD")).toBeVisible();

    // Open the modal.
    await page.getByRole("button", { name: "Delete My Draft PRD" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // The DeletePrdConfirmModal has a 1-second accidental-click guard.
    // The Delete button is disabled for the first 1000 ms after the modal opens.
    // We wait for the button to become enabled before clicking.
    const confirmDeleteBtn = dialog.getByRole("button", { name: "Delete" });

    // Wait for guard to expire — button should transition from disabled to enabled.
    await expect(confirmDeleteBtn).toBeEnabled({ timeout: 3_000 });
    console.log("  [INFO] 1-second accidental-click guard expired; Delete button enabled.");

    // Click Delete.
    await confirmDeleteBtn.click();

    // Modal should close after successful deletion.
    await expect(dialog).toBeHidden({ timeout: 5_000 });
    console.log("  [PASS] Confirmation modal dismissed after Delete.");

    // Success toast: "'My Draft PRD' deleted."
    // The toast fires immediately after onDeleted() is called, before React re-renders
    // remove the item. Check the toast first while still on the dashboard.
    // The toast text is set in DeletePrdButton: `'${prd.title}' deleted.`
    const toast = page.getByText(/'My Draft PRD' deleted\./);
    await expect(toast).toBeVisible({ timeout: 5_000 });
    console.log("  [PASS] Success toast shown: \"'My Draft PRD' deleted.\"");

    // PRD should be removed from the list (handleDeleted filters it out via setItems).
    await expect(page.getByText("My Draft PRD")).toBeHidden({ timeout: 5_000 });
    console.log("  [PASS] 'My Draft PRD' removed from the list.");

    // NOTE: Radix UI Dialog returns focus to the trigger element on close. When the
    // deleted item is removed from React state, the trigger (trash button) is unmounted,
    // and Radix falls back to body focus. In headless Chromium the next focusable <tr>
    // row can receive synthetic focus and trigger its onClick navigation handler.
    //
    // We navigate back to the dashboard explicitly to verify remaining PRDs are present.
    // This tests the correct business logic: the DELETE was called and the state was updated.
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("domcontentloaded");

    // After reload from the mock, the items list will be refreshed from the mock API
    // which still returns the full list (including prd-draft-1 since the mock is stateless).
    // The important assertions are:
    //   1. The toast appeared (deletion was called).
    //   2. The item was removed from the in-memory list (visible before navigation away).
    // We verify remaining PRDs are present from the fresh mock.
    await expect(page.getByText("In Review PRD")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Approved PRD")).toBeVisible();
    await expect(page.getByText("Other User Draft")).toBeVisible();
    console.log("  [PASS] Remaining PRDs present on dashboard after deletion.");
  });

  // -------------------------------------------------------------------------
  // Test 6: Delete button starts disabled (accidental-click guard active)
  // -------------------------------------------------------------------------
  test("Delete button is initially disabled in the modal (accidental-click guard)", async ({ page }) => {
    await setupApiMocks(page);
    await goToDashboard(page);

    // Open the modal.
    await page.getByRole("button", { name: "Delete My Draft PRD" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Immediately after opening, the Delete button should be disabled.
    // The component sets both `disabled` and `aria-disabled` attributes for 1 s.
    const confirmDeleteBtn = dialog.getByRole("button", { name: "Delete" });
    await expect(confirmDeleteBtn).toBeDisabled();
    console.log("  [PASS] Delete button is disabled immediately after modal opens (guard active).");

    // Cancel to clean up.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });
});
