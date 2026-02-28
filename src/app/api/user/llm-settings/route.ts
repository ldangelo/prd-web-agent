/**
 * /api/user/llm-settings - Per-user LLM provider/model/API key management.
 *
 * GET    - Return current settings (never exposes raw API key)
 * PUT    - Create or update settings (encrypts API key at rest)
 * DELETE - Remove user settings (revert to global defaults)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { validateBody } from "@/lib/api/validate";
import { encryptApiKey } from "@/lib/crypto";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ALLOWED_PROVIDERS = ["anthropic", "openrouter", "openai"] as const;

const UpdateSettingsSchema = z.object({
  provider: z.enum(ALLOWED_PROVIDERS),
  model: z.string().min(1).max(200),
  apiKey: z.string().min(1, "API key is required"),
});

// ---------------------------------------------------------------------------
// GET /api/user/llm-settings
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const session = await requireAuth();

    const settings = await prisma.userLlmSettings.findUnique({
      where: { userId: session.user.id },
    });

    if (!settings) {
      return apiSuccess({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        hasApiKey: false,
      });
    }

    return apiSuccess({
      provider: settings.provider,
      model: settings.model,
      hasApiKey: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/user/llm-settings
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await validateBody(UpdateSettingsSchema, request);

    const encryptedKey = encryptApiKey(body.apiKey);

    const settings = await prisma.userLlmSettings.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        provider: body.provider,
        model: body.model,
        apiKey: encryptedKey,
      },
      update: {
        provider: body.provider,
        model: body.model,
        apiKey: encryptedKey,
      },
    });

    return apiSuccess({
      provider: settings.provider,
      model: settings.model,
      hasApiKey: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/user/llm-settings
// ---------------------------------------------------------------------------

export async function DELETE() {
  try {
    const session = await requireAuth();

    await prisma.userLlmSettings.deleteMany({
      where: { userId: session.user.id },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
