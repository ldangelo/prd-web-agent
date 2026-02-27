/**
 * /api/admin/settings - Global settings API routes.
 *
 * GET  - Retrieve global settings.
 * PUT  - Update global settings (admin only).
 */
import { type NextRequest } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/admin/settings
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const settings = await prisma.globalSettings.findUnique({
      where: { id: "global" },
    });

    if (!settings) {
      return apiSuccess(null);
    }

    return apiSuccess(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/admin/settings
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();

    // Filter to only allowed fields
    const allowedFields = [
      "llmProvider",
      "llmModel",
      "llmThinkingLevel",
      "blockApprovalOnUnresolvedComments",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    const settings = await prisma.globalSettings.upsert({
      where: { id: "global" },
      update: updateData,
      create: {
        id: "global",
        ...updateData,
      },
    });

    return apiSuccess(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
