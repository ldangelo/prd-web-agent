/**
 * Zod-based request validation helpers for Next.js API routes.
 *
 * validateBody parses a JSON request body against a Zod schema.
 * validateQuery parses URL search parameters against a Zod schema.
 * Both throw ValidationError on failure with structured error details.
 */
import { type ZodSchema, type ZodIssue } from "zod";
import { ValidationError } from "./errors";

/**
 * Check if an error is a ZodError by duck-typing its shape.
 * This avoids instanceof issues across module boundaries in test environments.
 */
function isZodError(error: unknown): error is { issues: ZodIssue[] } {
  return (
    error !== null &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown }).issues)
  );
}

/**
 * Parse and validate a JSON request body against a Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @param request - The incoming Request object
 * @returns Parsed and validated data of type T
 * @throws ValidationError if JSON is invalid or data fails validation
 */
export async function validateBody<T>(
  schema: ZodSchema<T>,
  request: Request,
): Promise<T> {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON in request body");
  }

  try {
    return schema.parse(rawBody);
  } catch (error) {
    if (isZodError(error)) {
      throw new ValidationError("Validation failed", {
        errors: error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
    }
    throw error;
  }
}

/**
 * Parse and validate URL search parameters against a Zod schema.
 *
 * Converts URLSearchParams to a plain object before validation.
 * Works well with z.coerce for type conversion from string params.
 *
 * @param schema - Zod schema to validate against
 * @param url - The URL object containing search parameters
 * @returns Parsed and validated data of type T
 * @throws ValidationError if parameters fail validation
 */
export async function validateQuery<T>(
  schema: ZodSchema<T>,
  url: URL,
): Promise<T> {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  try {
    return schema.parse(params);
  } catch (error) {
    if (isZodError(error)) {
      throw new ValidationError("Invalid query parameters", {
        errors: error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      });
    }
    throw error;
  }
}
