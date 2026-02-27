/**
 * API Response helper tests (TDD: Red phase)
 *
 * Tests for standardized API response formatting functions.
 * All responses follow the shape: { data?, error?, message? }
 */
import { apiSuccess, apiError } from "../response";

describe("apiSuccess", () => {
  it("should return a JSON response with data field", async () => {
    const response = apiSuccess({ id: 1, name: "Test" });
    const body = await response.json();

    expect(body).toEqual({ data: { id: 1, name: "Test" } });
  });

  it("should default to 200 status", async () => {
    const response = apiSuccess({ ok: true });

    expect(response.status).toBe(200);
  });

  it("should allow custom status codes", async () => {
    const response = apiSuccess({ id: 1 }, 201);

    expect(response.status).toBe(201);
  });

  it("should set application/json content type", async () => {
    const response = apiSuccess({ ok: true });
    const contentType = response.headers.get("content-type");

    expect(contentType).toContain("application/json");
  });

  it("should handle null data", async () => {
    const response = apiSuccess(null);
    const body = await response.json();

    expect(body).toEqual({ data: null });
  });

  it("should handle array data", async () => {
    const items = [{ id: 1 }, { id: 2 }];
    const response = apiSuccess(items);
    const body = await response.json();

    expect(body).toEqual({ data: items });
  });
});

describe("apiError", () => {
  it("should return a JSON response with error and message fields", async () => {
    const response = apiError("Something went wrong", 500);
    const body = await response.json();

    expect(body).toEqual({
      error: "Something went wrong",
      message: "Something went wrong",
    });
  });

  it("should use the provided status code", async () => {
    const response = apiError("Not found", 404);

    expect(response.status).toBe(404);
  });

  it("should include optional details", async () => {
    const details = { field: "email", issue: "required" };
    const response = apiError("Validation failed", 422, details);
    const body = await response.json();

    expect(body).toEqual({
      error: "Validation failed",
      message: "Validation failed",
      details: { field: "email", issue: "required" },
    });
  });

  it("should set application/json content type", async () => {
    const response = apiError("Error", 500);
    const contentType = response.headers.get("content-type");

    expect(contentType).toContain("application/json");
  });
});
