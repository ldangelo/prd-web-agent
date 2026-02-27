/**
 * /api/search - Full-text search API route.
 *
 * GET - Search PRDs via OpenSearch with optional filters.
 */
import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess } from "@/lib/api/response";
import { apiError } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { SearchService } from "@/services/search-service";

const searchService = new SearchService();

// ---------------------------------------------------------------------------
// GET /api/search?q=<query>&project=&status=&from=&to=
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.trim() === "") {
      return apiError("Query parameter 'q' is required", 400);
    }

    const filters: Record<string, string> = {};
    const project = searchParams.get("project");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (project) filters.projectId = project;
    if (status) filters.status = status;
    if (from) filters.from = from;
    if (to) filters.to = to;

    const results = await searchService.searchPrds(
      query,
      Object.keys(filters).length > 0 ? filters : undefined,
    );

    return apiSuccess(results);
  } catch (error) {
    return handleApiError(error);
  }
}
