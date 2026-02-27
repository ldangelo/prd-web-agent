/**
 * Readiness probe endpoint tests.
 *
 * Tests for GET /api/healthz which checks DB, Redis, and OpenSearch connectivity.
 * All external clients are mocked.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockQueryRaw = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

const mockRedisConnect = jest.fn();
const mockRedisPing = jest.fn();
const mockRedisDisconnect = jest.fn();

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    connect: (...args: unknown[]) => mockRedisConnect(...args),
    ping: (...args: unknown[]) => mockRedisPing(...args),
    disconnect: (...args: unknown[]) => mockRedisDisconnect(...args),
  }));
});

const mockClusterHealth = jest.fn();

jest.mock("@opensearch-project/opensearch", () => ({
  Client: jest.fn().mockImplementation(() => ({
    cluster: {
      health: (...args: unknown[]) => mockClusterHealth(...args),
    },
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET } from "../route";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/healthz", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 when all dependencies are healthy", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue("PONG");
    mockClusterHealth.mockResolvedValue({ body: { status: "green" } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("ok");
    expect(body.data.checks.database.status).toBe("up");
    expect(body.data.checks.redis.status).toBe("up");
    expect(body.data.checks.opensearch.status).toBe("up");
  });

  it("should return 503 when database is down", async () => {
    mockQueryRaw.mockRejectedValue(new Error("Connection refused"));
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue("PONG");
    mockClusterHealth.mockResolvedValue({ body: { status: "green" } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.data.status).toBe("degraded");
    expect(body.data.checks.database.status).toBe("down");
    expect(body.data.checks.database.error).toBe("Connection refused");
    expect(body.data.checks.redis.status).toBe("up");
    expect(body.data.checks.opensearch.status).toBe("up");
  });

  it("should return 503 when redis is down", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockRedisConnect.mockRejectedValue(new Error("ECONNREFUSED"));
    mockClusterHealth.mockResolvedValue({ body: { status: "green" } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.data.status).toBe("degraded");
    expect(body.data.checks.database.status).toBe("up");
    expect(body.data.checks.redis.status).toBe("down");
    expect(body.data.checks.redis.error).toBe("ECONNREFUSED");
  });

  it("should return 503 when opensearch is down", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue("PONG");
    mockClusterHealth.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.data.status).toBe("degraded");
    expect(body.data.checks.database.status).toBe("up");
    expect(body.data.checks.redis.status).toBe("up");
    expect(body.data.checks.opensearch.status).toBe("down");
    expect(body.data.checks.opensearch.error).toBe("connect ECONNREFUSED");
  });

  it("should return 503 when all dependencies are down", async () => {
    mockQueryRaw.mockRejectedValue(new Error("DB error"));
    mockRedisConnect.mockRejectedValue(new Error("Redis error"));
    mockClusterHealth.mockRejectedValue(new Error("OpenSearch error"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.data.status).toBe("degraded");
    expect(body.data.checks.database.status).toBe("down");
    expect(body.data.checks.redis.status).toBe("down");
    expect(body.data.checks.opensearch.status).toBe("down");
  });

  it("should include latency measurements for each check", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockResolvedValue("PONG");
    mockClusterHealth.mockResolvedValue({ body: { status: "green" } });

    const response = await GET();
    const body = await response.json();

    expect(body.data.checks.database.latencyMs).toEqual(expect.any(Number));
    expect(body.data.checks.redis.latencyMs).toEqual(expect.any(Number));
    expect(body.data.checks.opensearch.latencyMs).toEqual(expect.any(Number));
  });

  it("should disconnect redis even when ping fails", async () => {
    mockRedisConnect.mockResolvedValue(undefined);
    mockRedisPing.mockRejectedValue(new Error("NOAUTH"));
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockClusterHealth.mockResolvedValue({ body: { status: "green" } });

    await GET();

    expect(mockRedisDisconnect).toHaveBeenCalled();
  });
});
