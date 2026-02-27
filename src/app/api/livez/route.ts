/**
 * Liveness probe endpoint.
 *
 * Always returns 200 to indicate the process is alive.
 * This endpoint does NOT check external dependencies --
 * that is the responsibility of the readiness probe (/api/healthz).
 */
import { apiSuccess } from "@/lib/api";

export async function GET() {
  return apiSuccess({ status: "ok" });
}
