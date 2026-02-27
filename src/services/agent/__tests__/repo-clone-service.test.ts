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

  it("returns correct clone directory", () => {
    const dir = service.getCloneDir("project-abc");
    expect(dir).toBe("/test/efs/repos/project-abc");
  });

  it("clones a repo to the correct directory", async () => {
    fsPromises.access.mockRejectedValue(new Error("ENOENT"));
    fsPromises.mkdir.mockResolvedValue(undefined);
    mockExecSuccess();

    await service.cloneRepo("project-1", "https://github.com/org/repo.git", "token-123");

    expect(mockedExec).toHaveBeenCalledWith(
      expect.stringContaining("git clone"),
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("starts periodic sync timer", async () => {
    fsPromises.access.mockResolvedValue(undefined);
    mockExecSuccess();

    await service.ensureSynced("project-1", "/test/efs/repos/project-1");

    // Advance past one sync interval
    jest.advanceTimersByTime(15 * 60 * 1000);

    // exec should have been called for the initial sync and then the periodic one
    expect(mockedExec).toHaveBeenCalledTimes(2);
  });

  it("cleans up timer on removeClone", async () => {
    fsPromises.access.mockResolvedValue(undefined);
    fsPromises.rm.mockResolvedValue(undefined);
    mockExecSuccess();

    await service.ensureSynced("project-1", "/test/efs/repos/project-1");
    await service.removeClone("project-1");

    // Advance past sync interval - should NOT trigger another exec
    const callCountAfterRemove = mockedExec.mock.calls.length;
    jest.advanceTimersByTime(15 * 60 * 1000);
    expect(mockedExec).toHaveBeenCalledTimes(callCountAfterRemove);
  });

  it("disposeAll clears all timers", async () => {
    fsPromises.access.mockResolvedValue(undefined);
    mockExecSuccess();

    await service.ensureSynced("project-1", "/test/efs/repos/project-1");
    await service.ensureSynced("project-2", "/test/efs/repos/project-2");
    await service.disposeAll();

    const callCountAfterDispose = mockedExec.mock.calls.length;
    jest.advanceTimersByTime(15 * 60 * 1000);
    expect(mockedExec).toHaveBeenCalledTimes(callCountAfterDispose);
  });

  it("handles sync failure gracefully (non-fatal)", async () => {
    fsPromises.access.mockResolvedValue(undefined);
    mockExecFailure("network error");

    // Should not throw
    await expect(
      service.ensureSynced("project-1", "/test/efs/repos/project-1"),
    ).resolves.not.toThrow();
  });
});
