/**
 * Version history API route tests.
 *
 * Tests for:
 * - GET /api/prds/[id]/versions  (list versions)
 * - GET /api/prds/[id]/versions/[version]  (get specific version)
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockPrdFindUnique = jest.fn();
const mockPrdVersionFindMany = jest.fn();
const mockPrdVersionFindFirst = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findUnique: (...args: unknown[]) => mockPrdFindUnique(...args),
    },
    prdVersion: {
      findMany: (...args: unknown[]) => mockPrdVersionFindMany(...args),
      findFirst: (...args: unknown[]) => mockPrdVersionFindFirst(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET as listVersions } from "../route";
import { GET as getVersion } from "../../versions/[version]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Tests: GET /api/prds/[id]/versions
// ---------------------------------------------------------------------------

describe("GET /api/prds/[id]/versions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns version list for a valid PRD", async () => {
    mockPrdFindUnique.mockResolvedValue({ id: "prd_001", title: "Test PRD" });
    mockPrdVersionFindMany.mockResolvedValue([
      {
        id: "v1",
        prdId: "prd_001",
        version: 1,
        authorId: "user_1",
        changeSummary: "Initial draft",
        createdAt: new Date("2026-02-20T10:00:00.000Z"),
      },
      {
        id: "v2",
        prdId: "prd_001",
        version: 2,
        authorId: "user_1",
        changeSummary: "Updated scope",
        createdAt: new Date("2026-02-22T14:00:00.000Z"),
      },
    ]);

    const response = await listVersions(
      makeRequest("http://localhost/api/prds/prd_001/versions") as any,
      { params: { id: "prd_001" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({
      version: 1,
      changeSummary: "Initial draft",
    });
    expect(body.data[1]).toMatchObject({
      version: 2,
      changeSummary: "Updated scope",
    });
  });

  it("returns 404 when PRD does not exist", async () => {
    mockPrdFindUnique.mockResolvedValue(null);

    const response = await listVersions(
      makeRequest("http://localhost/api/prds/prd_999/versions") as any,
      { params: { id: "prd_999" } },
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("PRD not found");
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /api/prds/[id]/versions/[version]
// ---------------------------------------------------------------------------

describe("GET /api/prds/[id]/versions/[version]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns specific version content", async () => {
    mockPrdVersionFindFirst.mockResolvedValue({
      id: "v2",
      prdId: "prd_001",
      version: 2,
      content: "# Updated PRD Content",
      authorId: "user_1",
      changeSummary: "Updated scope",
      createdAt: new Date("2026-02-22T14:00:00.000Z"),
    });

    const response = await getVersion(
      makeRequest(
        "http://localhost/api/prds/prd_001/versions/2",
      ) as any,
      { params: { id: "prd_001", version: "2" } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      version: 2,
      content: "# Updated PRD Content",
      changeSummary: "Updated scope",
    });
  });

  it("returns 404 when version does not exist", async () => {
    mockPrdVersionFindFirst.mockResolvedValue(null);

    const response = await getVersion(
      makeRequest(
        "http://localhost/api/prds/prd_001/versions/99",
      ) as any,
      { params: { id: "prd_001", version: "99" } },
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain("Version not found");
  });
});
