/**
 * RepoCloneService tests (updated for TASK-068)
 *
 * Per-user clones: /efs/repos/<user-id>/<project-id>/
 * Uses user's GitHub OAuth token passed as parameter
 * Token injected into clone URL for HTTPS clones
 * Surfaces 401 errors clearly for token refresh handling
 */
import { RepoCloneService } from "../../repo-clone-service";
import { exec } from "child_process";

jest.mock("child_process", () => ({
  exec: jest.fn(),
}));

jest.mock("fs/promises", () => ({
  access: jest.fn(),
  rm: jest.fn(),
  mkdir: jest.fn(),
}));

const mockedExec = jest.mocked(exec);
const fsPromises = require("fs/promises") as {
  access: jest.Mock;
  rm: jest.Mock;
  mkdir: jest.Mock;
};

function mockExecSuccess(stdout = "") {
  mockedExec.mockImplementation((_cmd: any, _opts: any, cb?: any) => {
    const callback = typeof _opts === "function" ? _opts : cb;
    if (callback) callback(null, stdout, "");
    return {} as any;
  });
}

function mockExecFailure(message: string) {
  mockedExec.mockImplementation((_cmd: any, _opts: any, cb?: any) => {
    const callback = typeof _opts === "function" ? _opts : cb;
    if (callback) callback(new Error(message), "", message);
    return {} as any;
  });
}

describe("RepoCloneService", () => {
  let service: RepoCloneService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new RepoCloneService("/test/efs/repos");
  });

  afterEach(async () => {
    await service.disposeAll();
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // TASK-068: Per-user clone directories
  // -------------------------------------------------------------------------

  describe("getCloneDir", () => {
    it("returns per-user clone directory with userId and projectId", () => {
      const dir = service.getCloneDir("user-abc", "project-xyz");
      expect(dir).toBe("/test/efs/repos/user-abc/project-xyz");
    });

    it("uses both userId and projectId in the path", () => {
      const dir1 = service.getCloneDir("user-1", "project-a");
      const dir2 = service.getCloneDir("user-2", "project-a");

      expect(dir1).not.toBe(dir2);
      expect(dir1).toBe("/test/efs/repos/user-1/project-a");
      expect(dir2).toBe("/test/efs/repos/user-2/project-a");
    });
  });

  // -------------------------------------------------------------------------
  // TASK-068: Clone with user OAuth token
  // -------------------------------------------------------------------------

  describe("cloneRepo", () => {
    it("clones a repo to the per-user directory", async () => {
      fsPromises.access.mockRejectedValue(new Error("ENOENT"));
      fsPromises.mkdir.mockResolvedValue(undefined);
      mockExecSuccess();

      await service.cloneRepo(
        "user-1",
        "project-1",
        "https://github.com/org/repo.git",
        "gho_usertoken123",
      );

      expect(mockedExec).toHaveBeenCalledWith(
        expect.stringContaining("git clone"),
        expect.any(Object),
        expect.any(Function),
      );

      // Verify the clone directory includes userId
      const cloneCmd = (mockedExec.mock.calls[0] as any[])[0] as string;
      expect(cloneCmd).toContain("/test/efs/repos/user-1/project-1");
    });

    it("injects OAuth token into clone URL", async () => {
      fsPromises.access.mockRejectedValue(new Error("ENOENT"));
      fsPromises.mkdir.mockResolvedValue(undefined);
      mockExecSuccess();

      await service.cloneRepo(
        "user-1",
        "project-1",
        "https://github.com/org/repo.git",
        "gho_mytoken",
      );

      const cloneCmd = (mockedExec.mock.calls[0] as any[])[0] as string;
      expect(cloneCmd).toContain(
        "https://x-access-token:gho_mytoken@github.com/org/repo.git",
      );
    });

    it("pulls instead of cloning if directory already exists", async () => {
      fsPromises.access.mockResolvedValue(undefined);
      mockExecSuccess();

      await service.cloneRepo(
        "user-1",
        "project-1",
        "https://github.com/org/repo.git",
        "gho_token",
      );

      const cmd = (mockedExec.mock.calls[0] as any[])[0] as string;
      expect(cmd).toContain("git pull");
    });

    it("creates nested directory with recursive mkdir", async () => {
      fsPromises.access.mockRejectedValue(new Error("ENOENT"));
      fsPromises.mkdir.mockResolvedValue(undefined);
      mockExecSuccess();

      await service.cloneRepo(
        "user-1",
        "project-1",
        "https://github.com/org/repo.git",
        "gho_token",
      );

      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        "/test/efs/repos/user-1/project-1",
        { recursive: true },
      );
    });
  });

  // -------------------------------------------------------------------------
  // TASK-068: 401 error handling for token issues
  // -------------------------------------------------------------------------

  describe("clone/pull 401 error handling", () => {
    it("throws a clear error when clone fails with 401/authentication", async () => {
      fsPromises.access.mockRejectedValue(new Error("ENOENT"));
      fsPromises.mkdir.mockResolvedValue(undefined);
      mockExecFailure("Authentication failed for 'https://github.com/org/repo.git'");

      await expect(
        service.cloneRepo(
          "user-1",
          "project-1",
          "https://github.com/org/repo.git",
          "gho_expired",
        ),
      ).rejects.toThrow(/authentication failed/i);
    });

    it("throws a clear error when clone fails with 'could not read Username'", async () => {
      fsPromises.access.mockRejectedValue(new Error("ENOENT"));
      fsPromises.mkdir.mockResolvedValue(undefined);
      mockExecFailure("fatal: could not read Username for 'https://github.com': terminal prompts disabled");

      await expect(
        service.cloneRepo(
          "user-1",
          "project-1",
          "https://github.com/org/repo.git",
          "gho_bad",
        ),
      ).rejects.toThrow(/authentication|token/i);
    });
  });

  // -------------------------------------------------------------------------
  // Existing functionality (updated signatures)
  // -------------------------------------------------------------------------

  describe("ensureSynced", () => {
    it("starts periodic sync timer", async () => {
      fsPromises.access.mockResolvedValue(undefined);
      mockExecSuccess();

      await service.ensureSynced(
        "user-1",
        "project-1",
        "/test/efs/repos/user-1/project-1",
      );

      jest.advanceTimersByTime(15 * 60 * 1000);

      // exec should have been called for the initial sync and then the periodic one
      expect(mockedExec).toHaveBeenCalledTimes(2);
    });

    it("handles sync failure gracefully (non-fatal)", async () => {
      fsPromises.access.mockResolvedValue(undefined);
      mockExecFailure("network error");

      await expect(
        service.ensureSynced(
          "user-1",
          "project-1",
          "/test/efs/repos/user-1/project-1",
        ),
      ).resolves.not.toThrow();
    });
  });

  describe("removeClone", () => {
    it("cleans up timer and removes per-user clone directory", async () => {
      fsPromises.access.mockResolvedValue(undefined);
      fsPromises.rm.mockResolvedValue(undefined);
      mockExecSuccess();

      await service.ensureSynced(
        "user-1",
        "project-1",
        "/test/efs/repos/user-1/project-1",
      );
      await service.removeClone("user-1", "project-1");

      const callCountAfterRemove = mockedExec.mock.calls.length;
      jest.advanceTimersByTime(15 * 60 * 1000);
      expect(mockedExec).toHaveBeenCalledTimes(callCountAfterRemove);
    });

    it("removes the correct per-user directory", async () => {
      fsPromises.rm.mockResolvedValue(undefined);

      await service.removeClone("user-1", "project-1");

      expect(fsPromises.rm).toHaveBeenCalledWith(
        "/test/efs/repos/user-1/project-1",
        { recursive: true, force: true },
      );
    });
  });

  describe("disposeAll", () => {
    it("clears all timers", async () => {
      fsPromises.access.mockResolvedValue(undefined);
      mockExecSuccess();

      await service.ensureSynced(
        "user-1",
        "project-1",
        "/test/efs/repos/user-1/project-1",
      );
      await service.ensureSynced(
        "user-2",
        "project-2",
        "/test/efs/repos/user-2/project-2",
      );
      await service.disposeAll();

      const callCountAfterDispose = mockedExec.mock.calls.length;
      jest.advanceTimersByTime(15 * 60 * 1000);
      expect(mockedExec).toHaveBeenCalledTimes(callCountAfterDispose);
    });
  });
});
