/**
 * Server-side session helper.
 *
 * Provides a convenience wrapper around next-auth's auth() function
 * for use in server components and API route handlers.
 */
import { auth } from "./auth";

/**
 * Get the current user session on the server side.
 *
 * Returns null if the user is not authenticated.
 */
export async function getServerSession() {
  return auth();
}
