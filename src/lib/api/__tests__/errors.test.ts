/**
 * API Error classes and handler tests (TDD: Red phase)
 *
 * Tests for custom error classes with appropriate HTTP status codes
 * and the handleApiError function that converts errors to API responses.
 */
import {
  ApiError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  handleApiError,
} from "../errors";

describe("ApiError", () => {
  it("should store message and status code", () => {
    const error = new ApiError("Something failed", 503);

    expect(error.message).toBe("Something failed");
    expect(error.statusCode).toBe(503);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
  });

  it("should store optional details", () => {
    const details = { retryAfter: 30 };
    const error = new ApiError("Rate limited", 429, details);

    expect(error.details).toEqual({ retryAfter: 30 });
  });

  it("should have undefined details by default", () => {
    const error = new ApiError("Error", 500);

    expect(error.details).toBeUndefined();
  });
});

describe("ValidationError", () => {
  it("should default to 422 status code", () => {
    const error = new ValidationError("Invalid input");

    expect(error.statusCode).toBe(422);
    expect(error.message).toBe("Invalid input");
    expect(error).toBeInstanceOf(ApiError);
  });

  it("should accept validation details", () => {
    const details = { fields: { email: "required" } };
    const error = new ValidationError("Validation failed", details);

    expect(error.details).toEqual(details);
  });
});

describe("NotFoundError", () => {
  it("should default to 404 status code", () => {
    const error = new NotFoundError("Resource not found");

    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Resource not found");
    expect(error).toBeInstanceOf(ApiError);
  });

  it("should use default message if none provided", () => {
    const error = new NotFoundError();

    expect(error.message).toBe("Not found");
    expect(error.statusCode).toBe(404);
  });
});

describe("UnauthorizedError", () => {
  it("should default to 401 status code", () => {
    const error = new UnauthorizedError();

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Unauthorized");
    expect(error).toBeInstanceOf(ApiError);
  });

  it("should accept custom message", () => {
    const error = new UnauthorizedError("Token expired");

    expect(error.message).toBe("Token expired");
  });
});

describe("ForbiddenError", () => {
  it("should default to 403 status code", () => {
    const error = new ForbiddenError();

    expect(error.statusCode).toBe(403);
    expect(error.message).toBe("Forbidden");
    expect(error).toBeInstanceOf(ApiError);
  });

  it("should accept custom message", () => {
    const error = new ForbiddenError("Insufficient permissions");

    expect(error.message).toBe("Insufficient permissions");
  });
});

describe("handleApiError", () => {
  it("should convert ApiError to proper response", async () => {
    const error = new ApiError("Server error", 503);
    const response = handleApiError(error);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "Server error",
      message: "Server error",
    });
  });

  it("should include details from ApiError", async () => {
    const error = new ValidationError("Bad input", {
      fields: { name: "required" },
    });
    const response = handleApiError(error);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toEqual({
      error: "Bad input",
      message: "Bad input",
      details: { fields: { name: "required" } },
    });
  });

  it("should convert unknown errors to 500 with generic message", async () => {
    const error = new Error("something unexpected");
    const response = handleApiError(error);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Internal server error",
      message: "Internal server error",
    });
  });

  it("should handle non-Error objects", async () => {
    const response = handleApiError("string error");
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Internal server error",
      message: "Internal server error",
    });
  });
});
