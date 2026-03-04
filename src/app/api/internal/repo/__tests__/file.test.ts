/**
 * GET /api/internal/repo/file — unit tests.
 *
 * Covers: auth, parameter validation, clone-not-found, path traversal
 * protection, file-too-large, directory rejection, success path, and
 * unexpected error handling.
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
const mockFsStat = jest.fn();
const mockFsReadFile = jest.fn();

jest.mock("fs/promises", () => ({
  access: (...args: unknown[]) => mockFsAccess(...args),
  stat: (...args: unknown[]) => mockFsStat(...args),
  readFile: (...args: unknown[]) => mockFsReadFile(...args),
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
import { GET } from "../file/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TOKEN = "test-internal-token";
const CLONE_DIR = "/efs/repos/user_001/proj_001";
const FILE_CONTENT = "export const hello = 'world';";
const GITHUB_REPO = "https://github.com/org/repo.git";
const OAUTH_TOKEN = "gho_test";

function makeRequest(
  params: Record<string, string>,
  token?: string,
): NextRequest {
  const url = new URL("http://localhost/api/internal/repo/file");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString(), {
    method: "GET",
    headers: token !== undefined ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Build a minimal stat object. */
function makeStat(size: number, isDirectory = false) {
  return {
    size,
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
  // Default: small file
  mockFsStat.mockResolvedValue(makeStat(FILE_CONTENT.length));
  // Default: file content
  mockFsReadFile.mockResolvedValue(FILE_CONTENT);
  // Default on-demand clone helpers (only used when access fails)
  mockProjectFindUnique.mockResolvedValue({ githubRepo: GITHUB_REPO });
  mockAccountFindFirst.mockResolvedValue({ access_token: OAUTH_TOKEN });
  mockCloneRepo.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/internal/repo/file", () => {
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it("returns 401 when Authorization header is missing", async () => {
    const req = makeRequest({
      projectId: "proj_001",
      userId: "user_001",
      path: "src/index.ts",
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "src/index.ts" },
      "wrong-token",
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it("returns 400 when projectId is missing", async () => {
    const req = makeRequest(
      { userId: "user_001", path: "src/index.ts" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/projectId/i);
  });

  it("returns 400 when userId is missing", async () => {
    const req = makeRequest(
      { projectId: "proj_001", path: "src/index.ts" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when path param is missing", async () => {
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/path/i);
  });

  // -------------------------------------------------------------------------
  // Clone not found
  // -------------------------------------------------------------------------

  it("clones on-demand and returns 200 when clone directory does not exist but project has a githubRepo", async () => {
    mockFsAccess.mockRejectedValue(new Error("ENOENT"));
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "src/index.ts" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(mockCloneRepo).toHaveBeenCalledWith(
      "user_001",
      "proj_001",
      GITHUB_REPO,
      OAUTH_TOKEN,
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 when clone directory does not exist and project has no githubRepo", async () => {
    mockFsAccess.mockRejectedValue(new Error("ENOENT"));
    mockProjectFindUnique.mockResolvedValue(null);
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "src/index.ts" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns 401 when clone directory does not exist and no OAuth token is available", async () => {
    mockFsAccess.mockRejectedValue(new Error("ENOENT"));
    mockAccountFindFirst.mockResolvedValue(null);
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "src/index.ts" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockCloneRepo).not.toHaveBeenCalled();
  });

  it("returns 502 when on-demand clone fails", async () => {
    mockFsAccess.mockRejectedValue(new Error("ENOENT"));
    mockCloneRepo.mockRejectedValue(new Error("clone failed"));
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "src/index.ts" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(res.status).toBe(502);
  });

  // -------------------------------------------------------------------------
  // Path traversal protection
  // -------------------------------------------------------------------------

  it("returns 400 when path contains directory traversal (../../)", async () => {
    const req = makeRequest(
      {
        projectId: "proj_001",
        userId: "user_001",
        path: "../../etc/passwd",
      },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid path/i);
  });

  it("returns 400 when path resolves outside the clone root", async () => {
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "../other-project/secret.key" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // File not found
  // -------------------------------------------------------------------------

  it("returns 404 when the file does not exist (stat throws)", async () => {
    mockFsStat.mockRejectedValue(new Error("ENOENT: no such file"));
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "nonexistent.ts" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Directory rejection
  // -------------------------------------------------------------------------

  it("returns 400 when path points to a directory", async () => {
    mockFsStat.mockResolvedValue(makeStat(0, true));
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "src" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/directory/i);
  });

  // -------------------------------------------------------------------------
  // File too large
  // -------------------------------------------------------------------------

  it("returns 413 when file exceeds 100 KB", async () => {
    const oversizeBytes = 100 * 1024 + 1;
    mockFsStat.mockResolvedValue(makeStat(oversizeBytes));
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "large.bin" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(413);
    expect(body.error).toMatch(/too large/i);
  });

  it("returns 200 for a file exactly at the 100 KB limit", async () => {
    const exactBytes = 100 * 1024;
    mockFsStat.mockResolvedValue(makeStat(exactBytes));
    mockFsReadFile.mockResolvedValue("x".repeat(exactBytes));
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "edge.txt" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------

  it("returns 200 with content, path, and size on success", async () => {
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "src/index.ts" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      content: FILE_CONTENT,
      path: "src/index.ts",
      size: FILE_CONTENT.length,
    });
  });

  it("calls RepoCloneService.getCloneDir with correct userId and projectId", async () => {
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "src/index.ts" },
      VALID_TOKEN,
    );
    await GET(req);
    expect(mockGetCloneDir).toHaveBeenCalledWith("user_001", "proj_001");
  });

  it("does not call readFile when stat fails", async () => {
    mockFsStat.mockRejectedValue(new Error("ENOENT"));
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "missing.ts" },
      VALID_TOKEN,
    );
    await GET(req);
    expect(mockFsReadFile).not.toHaveBeenCalled();
  });

  it("does not call readFile when file is too large", async () => {
    mockFsStat.mockResolvedValue(makeStat(200 * 1024));
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "huge.ts" },
      VALID_TOKEN,
    );
    await GET(req);
    expect(mockFsReadFile).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Internal error
  // -------------------------------------------------------------------------

  it("returns 500 on unexpected errors", async () => {
    mockFsReadFile.mockRejectedValue(new Error("Unexpected FS error"));
    const req = makeRequest(
      { projectId: "proj_001", userId: "user_001", path: "src/index.ts" },
      VALID_TOKEN,
    );
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
