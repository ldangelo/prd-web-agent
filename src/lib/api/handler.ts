/**
 * API route wrapper with automatic error handling.
 *
 * Wraps Next.js App Router route handlers with a try/catch boundary
 * that converts any thrown error to a standardized API error response.
 */
import { type NextRequest } from "next/server";
import { handleApiError } from "./errors";

type RouteContext = { params: Record<string, string> };

type RouteHandler = (
  request: NextRequest,
  context?: RouteContext,
) => Promise<Response>;

/**
 * Wrap a route handler with standardized error handling.
 *
 * Any error thrown inside the handler is caught and converted
 * to a proper JSON error response via handleApiError.
 *
 * @param handler - The async route handler function
 * @returns A wrapped handler that never throws
 */
export function withApiHandler(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: RouteContext) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
