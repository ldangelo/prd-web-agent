/**
 * NextAuth.js v5 API route handler.
 *
 * Exposes the GET and POST handlers from the NextAuth configuration
 * at /api/auth/* (sign-in, sign-out, callback, session, etc.).
 */
import { handlers } from "@/lib/auth/auth";

export const { GET, POST } = handlers;
