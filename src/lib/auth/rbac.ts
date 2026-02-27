/**
 * Role-Based Access Control (RBAC) middleware functions.
 *
 * These async guards check authentication and authorization by
 * inspecting the current session. They throw appropriate API errors
 * when access is denied, making them composable with the existing
 * API error handling infrastructure.
 */
import { auth } from "./auth";
import { UnauthorizedError, ForbiddenError } from "../api/errors";

/**
 * Require that the current request is authenticated.
 *
 * @throws UnauthorizedError if no valid session exists
 * @returns The authenticated session
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError("Authentication required");
  }
  return session;
}

/**
 * Require that the authenticated user has one of the specified roles.
 *
 * @param roles - One or more role strings that are permitted
 * @throws UnauthorizedError if not authenticated
 * @throws ForbiddenError if the user's role is not in the allowed list
 * @returns The authenticated session
 */
export async function requireRole(...roles: string[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    throw new ForbiddenError("Insufficient permissions");
  }
  return session;
}

/**
 * Convenience guard that requires the ADMIN role.
 *
 * @throws UnauthorizedError if not authenticated
 * @throws ForbiddenError if the user is not an ADMIN
 * @returns The authenticated session
 */
export async function requireAdmin() {
  return requireRole("ADMIN");
}
