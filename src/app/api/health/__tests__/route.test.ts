/**
 * Health endpoint tests (TDD: Red-Green-Refactor)
 *
 * These tests verify that the /api/health endpoint returns the expected
 * response shape and status code. Written before the implementation
 * as part of the TDD workflow.
 */
import { GET } from "../route";

describe("GET /api/health", () => {
  it("should return status ok with 200", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });

  it("should return application/json content type", async () => {
    const response = await GET();
    const contentType = response.headers.get("content-type");

    expect(contentType).toContain("application/json");
  });
});
