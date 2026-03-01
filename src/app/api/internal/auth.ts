/**
 * Internal API authentication helper.
 *
 * Validates requests from OpenClaw via a shared internal token.
 */
import { NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";

/**
 * Validate the internal token from the Authorization header.
 * Returns null if valid, or an error NextResponse if invalid.
 */
export function validateInternalToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = process.env.OPENCLAW_INTERNAL_TOKEN;

  if (!token) {
    return apiError("Internal token not configured", 500);
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return apiError("Missing authorization header", 401);
  }

  const provided = authHeader.slice(7);
  if (provided !== token) {
    return apiError("Invalid authorization token", 401);
  }

  return null;
}
