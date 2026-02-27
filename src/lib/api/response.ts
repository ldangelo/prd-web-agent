/**
 * Standardized API response helpers.
 *
 * All API responses follow the shape: { data?, error?, message?, details? }
 * Use apiSuccess for successful responses and apiError for error responses.
 */
import { NextResponse } from "next/server";

export interface ApiSuccessResponse<T = unknown> {
  data: T;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

/**
 * Create a successful API response.
 *
 * @param data - The response payload
 * @param status - HTTP status code (default: 200)
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ data } satisfies ApiSuccessResponse<T>, {
    status,
  });
}

/**
 * Create an error API response.
 *
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param details - Optional additional error details
 */
export function apiError(
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  const body: ApiErrorResponse = { error: message, message };
  if (details !== undefined) {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}
