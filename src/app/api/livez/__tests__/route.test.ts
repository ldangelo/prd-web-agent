/**
 * Liveness probe endpoint tests.
 *
 * The /api/livez endpoint should always return 200 with { status: "ok" }.
 */
import { GET } from "../route";

describe("GET /api/livez", () => {
  it("should return 200 with status ok", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { status: "ok" } });
  });

  it("should return application/json content type", async () => {
    const response = await GET();
    const contentType = response.headers.get("content-type");

    expect(contentType).toContain("application/json");
  });
});
