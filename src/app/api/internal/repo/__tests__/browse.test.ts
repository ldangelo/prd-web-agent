/**
 * GET /api/internal/repo/browse — unit tests.
 *
 * Covers: auth, parameter validation, path traversal protection,
 * clone-not-found, fs errors, excluded directories, success path.
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockGetCloneDir = jest.fn();
const mockCloneRepo = jest.fn();

jest.mock("@/services/repo-clone-service", () => ({
  RepoCloneService: jest.fn().mockImplementation(() => ({
    getCloneDir: (...args: unknown[]) => mockGetCloneDir(...args),
    cloneRepo: (...args: unknown[]) => mockCloneRepo(...args),
  })),
}));

const mockProjectFindUnique = jest.fn();
const mockAccountFindFirst = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: (...args: unknown[]) => mockProjectFindUnique(...args) },
    account: { findFirst: (...args: unknown[]) => mockAccountFindFirst(...args) },
  },
}));

const mockFsAccess = jest.fn();
const mockFsReaddir = jest.fn();

jest.mock("fs/promises", () => ({
  access: (...args: unknown[]) => mockFsAccess(...args),
  readdir: (...args: unknown[]) => mockFsReaddir(...args),
}));

jest.mock("@/lib/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { GET } from "../browse/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TOKEN = "test-internal-token";
const CLONE_DIR = "/efs/repos/user_001/proj_001";

function makeRequest(
  params: Record<string, string>,
  token?: string,
): NextRequest {
  const url = new URL("http://localhost/api/internal/repo/browse");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString(), {
    method: "GET",
    headers: token !== undefined ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Build a mock Dirent-like object. */
function makeDirent(name: string, isDirectory: boolean) {
  return {
    name,
    isDirectory: () => isDirectory,
    isFile: () => !isDirectory,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OPENCLAW_INTERNAL_TOKEN = VALID_TOKEN;

  mockGetCloneDir.mockReturnValue(CLONE_DIR);
  // Default: clone exists
  mockFsAccess.mockResolvedValue(undefined);
  // Default: empty directory
  mockFsReaddir.mockResolvedValue([]);
  // Default on-demand clone helpers (only used when access fails)
  mockProjectFindUnique.mockResolvedValue({ githubRepo: "https://github.com/org/repo.git" });
  mockAccountFindFirst.mockResolvedValue({ access_token: "gho_test" });
  mockCloneRepo.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/internal/repo/browse", () => {
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it("returns 401 when Authorization header is missing", async () => {
    const req = makeRequest({ projectId: "proj_001", userId: "user_001" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001" },
      "wrong-token",
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it("returns 400 when projectId is missing", async () => {
    const req = makeRequest({ userId: "user_001" }, VALID_TOKEN);
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/projectId/i);
  });

  it("returns 400 when userId is missing", async () => {
    const req = makeRequest({ projectId: "proj_001" }, VALID_TOKEN);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Clone not found
  // -------------------------------------------------------------------------

  it("clones on-demand and returns 200 when clone directory does not exist but project has a githubRepo", async () => {
    mockFsAccess.mockRejectedValue(new Error("ENOENT"));
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(mockCloneRepo).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("returns 404 when clone directory does not exist and project has no githubRepo", async () => {
    mockFsAccess.mockRejectedValue(new Error("ENOENT"));
    mockProjectFindUnique.mockResolvedValue(null);
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(404);
  });

  it("returns 502 when on-demand clone fails", async () => {
    mockFsAccess.mockRejectedValue(new Error("ENOENT"));
    mockCloneRepo.mockRejectedValue(new Error("clone failed"));
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(res.status).toBe(502);
  });

  // -------------------------------------------------------------------------
  // Path traversal protection
  // -------------------------------------------------------------------------

  it("returns 400 when path contains directory traversal (../)", async () => {
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "../../etc/passwd" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid path/i);
  });

  it("returns 400 when path resolves to an ancestor directory", async () => {
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: ".." },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // readdir failure
  // -------------------------------------------------------------------------

  it("returns 404 when readdir throws (path not found or not a directory)", async () => {
    mockFsReaddir.mockRejectedValue(new Error("ENOENT"));
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "src" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Excluded directories
  // -------------------------------------------------------------------------

  it("excludes .git, node_modules, .next, dist, build directories", async () => {
    mockFsReaddir.mockResolvedValue([
      makeDirent(".git", true),
      makeDirent("node_modules", true),
      makeDirent(".next", true),
      makeDirent("dist", true),
      makeDirent("build", true),
      makeDirent("src", true),
      makeDirent("README.md", false),
    ]);

    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    const names = body.data.entries.map((e: { name: string }) => e.name);
    expect(names).not.toContain(".git");
    expect(names).not.toContain("node_modules");
    expect(names).not.toContain(".next");
    expect(names).not.toContain("dist");
    expect(names).not.toContain("build");
    expect(names).toContain("src");
    expect(names).toContain("README.md");
  });

  // -------------------------------------------------------------------------
  // Success paths
  // -------------------------------------------------------------------------

  it("returns 200 with an empty entries array for an empty directory", async () => {
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.entries).toEqual([]);
  });

  it("returns correct entry shapes with type 'file' and 'dir'", async () => {
    mockFsReaddir.mockResolvedValue([
      makeDirent("src", true),
      makeDirent("package.json", false),
    ]);

    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.entries).toEqual(
      expect.arrayContaining([
        { name: "src", type: "dir", path: "src" },
        { name: "package.json", type: "file", path: "package.json" },
      ]),
    );
  });

  it("prepends the relative path prefix when browsing a subdirectory", async () => {
    mockFsReaddir.mockResolvedValue([makeDirent("index.ts", false)]);

    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "src/app" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.entries[0].path).toBe("src/app/index.ts");
  });

  it("sorts directories before files, then alphabetically within each group", async () => {
    mockFsReaddir.mockResolvedValue([
      makeDirent("z-file.ts", false),
      makeDirent("a-dir", true),
      makeDirent("a-file.ts", false),
      makeDirent("b-dir", true),
    ]);

    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();

    const names = body.data.entries.map((e: { name: string }) => e.name);
    expect(names).toEqual(["a-dir", "b-dir", "a-file.ts", "z-file.ts"]);
  });

  it("calls RepoCloneService.getCloneDir with the correct userId and projectId", async () => {
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001" },
      VALID_TOKEN,
    );
    await GET(req);
    expect(mockGetCloneDir).toHaveBeenCalledWith("user_001", "proj_001");
  });

  // -------------------------------------------------------------------------
  // Internal error
  // -------------------------------------------------------------------------

  it("returns 500 on unexpected errors (e.g. getCloneDir throws)", async () => {
    // Cause an error in the outer try block before any inner try/catch by
    // making getCloneDir itself throw.
    mockGetCloneDir.mockImplementation(() => {
      throw new Error("Unexpected service error");
    });

    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
