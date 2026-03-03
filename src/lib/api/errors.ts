/**
 * Custom API error classes with appropriate HTTP status codes.
 *
 * All custom errors extend ApiError, which extends the native Error class.
 * The handleApiError function converts any thrown value into a proper API response.
 */
import { apiError } from "./response";
import logger from "@/lib/logger";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;

    // Restore prototype chain (required when extending built-in classes in TS)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string = "Validation failed", details?: unknown) {
    super(message, 422, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = "Not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

/**
 * Convert any thrown error into a standardized API response.
 *
 * ApiError instances are converted using their statusCode and message.
 * Unknown errors produce a generic 500 response to avoid leaking internals.
 */
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return apiError(error.message, error.statusCode, error.details);
  }

  // Log the full error server-side before returning the sanitised 500
  logger.error({ error }, "Unhandled error in API route");
  return apiError("Internal server error", 500);
}
