/**
 * Zod validation helper tests (TDD: Red phase)
 *
 * Tests for request body and query parameter validation
 * using Zod schemas with proper error conversion.
 */
import { z } from "zod";
import { validateBody, validateQuery } from "../validate";
import { ValidationError } from "../errors";

describe("validateBody", () => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
  });

  it("should parse valid JSON body and return typed data", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John", email: "john@example.com" }),
    });

    const result = await validateBody(schema, request);

    expect(result).toEqual({ name: "John", email: "john@example.com" });
  });

  it("should throw ValidationError for invalid data", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "not-an-email" }),
    });

    await expect(validateBody(schema, request)).rejects.toThrow(
      ValidationError,
    );
  });

  it("should include field-level errors in details", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "bad" }),
    });

    try {
      await validateBody(schema, request);
      fail("Expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.details).toBeDefined();
      expect(validationError.details.errors).toBeDefined();
      expect(Array.isArray(validationError.details.errors)).toBe(true);
    }
  });

  it("should throw ValidationError for invalid JSON", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    await expect(validateBody(schema, request)).rejects.toThrow(
      ValidationError,
    );
  });

  it("should strip unknown fields by default", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "John",
        email: "john@example.com",
        extra: "field",
      }),
    });

    const result = await validateBody(schema, request);

    expect(result).toEqual({ name: "John", email: "john@example.com" });
    expect((result as Record<string, unknown>).extra).toBeUndefined();
  });
});

describe("validateQuery", () => {
  const schema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  });

  it("should parse valid query parameters", async () => {
    const url = new URL("http://localhost/api/test?page=2&limit=50");

    const result = await validateQuery(schema, url);

    expect(result).toEqual({ page: 2, limit: 50 });
  });

  it("should apply defaults for missing parameters", async () => {
    const url = new URL("http://localhost/api/test");

    const result = await validateQuery(schema, url);

    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it("should throw ValidationError for invalid query parameters", async () => {
    const url = new URL("http://localhost/api/test?page=-1&limit=999");

    await expect(validateQuery(schema, url)).rejects.toThrow(ValidationError);
  });

  it("should include error details", async () => {
    const url = new URL("http://localhost/api/test?page=abc");

    try {
      const strictSchema = z.object({
        page: z.coerce.number().int().positive(),
      });
      await validateQuery(strictSchema, url);
      fail("Expected ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});
