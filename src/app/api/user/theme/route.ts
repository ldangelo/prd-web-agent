/**
 * /api/user/theme - User theme preference management.
 *
 * GET  - Return current theme preference
 * PUT  - Update theme preference
 */
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { ValidationError } from "@/lib/api/errors";

const VALID_THEMES = ["LIGHT", "DARK", "SYSTEM"] as const;
type ThemePreference = (typeof VALID_THEMES)[number];

// ---------------------------------------------------------------------------
// GET /api/user/theme
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const session = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { themePreference: true },
    });

    return apiSuccess({ themePreference: user?.themePreference ?? "SYSTEM" });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/user/theme
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("themePreference" in body)
    ) {
      throw new ValidationError("Missing themePreference field");
    }

    const { themePreference } = body as { themePreference: unknown };

    if (!VALID_THEMES.includes(themePreference as ThemePreference)) {
      throw new ValidationError(
        `Invalid theme preference. Must be one of: ${VALID_THEMES.join(", ")}`,
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { themePreference: themePreference as ThemePreference },
      select: { themePreference: true },
    });

    return apiSuccess({ themePreference: user.themePreference });
  } catch (error) {
    return handleApiError(error);
  }
}
