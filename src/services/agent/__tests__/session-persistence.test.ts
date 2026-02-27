import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  getSessionDir,
  listUserSessions,
  findSessionFile,
} from "../session-persistence";

// ---------------------------------------------------------------------------
// Setup: use a temp directory as the EFS root
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-persist-test-"));
  process.env.EFS_SESSION_DIR = tmpDir;
});

afterEach(() => {
  delete process.env.EFS_SESSION_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getSessionDir", () => {
  it("returns the correct directory for a user and creates it", () => {
    const dir = getSessionDir("user-abc");
    expect(dir).toBe(path.join(tmpDir, "user-abc"));
    expect(fs.existsSync(dir)).toBe(true);
  });

  it("is idempotent -- calling twice returns the same path", () => {
    const a = getSessionDir("user-1");
    const b = getSessionDir("user-1");
    expect(a).toBe(b);
  });
});

describe("listUserSessions", () => {
  it("returns an empty list when the user has no sessions", async () => {
    const sessions = await listUserSessions("user-empty");
    expect(sessions).toEqual([]);
  });

  it("lists .json session files sorted newest first", async () => {
    const dir = getSessionDir("user-list");

    // Create two session files with slight time gap
    const file1 = path.join(dir, "sess-old.json");
    const file2 = path.join(dir, "sess-new.json");
    const file3 = path.join(dir, "not-a-session.txt"); // should be ignored

    fs.writeFileSync(file1, JSON.stringify({ id: "old" }));
    // Ensure different mtime
    const pastTime = new Date(Date.now() - 60_000);
    fs.utimesSync(file1, pastTime, pastTime);

    fs.writeFileSync(file2, JSON.stringify({ id: "new" }));
    fs.writeFileSync(file3, "ignored");

    const sessions = await listUserSessions("user-list");

    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionId).toBe("sess-new");
    expect(sessions[1].sessionId).toBe("sess-old");
    expect(sessions[0].filePath).toBe(file2);
    expect(sessions[0].sizeBytes).toBeGreaterThan(0);
  });
});

describe("findSessionFile", () => {
  it("returns the file path when the session file exists", async () => {
    const dir = getSessionDir("user-find");
    const filePath = path.join(dir, "my-session.json");
    fs.writeFileSync(filePath, "{}");

    const result = await findSessionFile("my-session", "user-find");
    expect(result).toBe(filePath);
  });

  it("returns null when the session file does not exist", async () => {
    getSessionDir("user-find"); // ensure dir exists
    const result = await findSessionFile("nonexistent", "user-find");
    expect(result).toBeNull();
  });
});
