/**
 * Readiness probe endpoint.
 *
 * Checks connectivity to all critical dependencies:
 * - PostgreSQL (via Prisma)
 * - Redis (via ioredis)
 * - OpenSearch
 *
 * Returns 200 if all dependencies are reachable, 503 otherwise.
 */
import { Client } from "@opensearch-project/opensearch";
import Redis from "ioredis";

import { apiSuccess, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

interface HealthStatus {
  status: "ok" | "degraded";
  checks: {
    database: CheckResult;
    redis: CheckResult;
    opensearch: CheckResult;
  };
}

interface CheckResult {
  status: "up" | "down";
  latencyMs?: number;
  error?: string;
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "up", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    lazyConnect: true,
    connectTimeout: 3000,
  });

  try {
    await redis.connect();
    await redis.ping();
    return { status: "up", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    try {
      redis.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  }
}

async function checkOpenSearch(): Promise<CheckResult> {
  const start = Date.now();
  const client = new Client({
    node: process.env.OPENSEARCH_URL || "http://localhost:9200",
  });

  try {
    await client.cluster.health();
    return { status: "up", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function GET() {
  try {
    const [database, redis, opensearch] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkOpenSearch(),
    ]);

    const allUp =
      database.status === "up" &&
      redis.status === "up" &&
      opensearch.status === "up";

    const health: HealthStatus = {
      status: allUp ? "ok" : "degraded",
      checks: { database, redis, opensearch },
    };

    if (!allUp) {
      return apiSuccess(health, 503);
    }

    return apiSuccess(health);
  } catch (error) {
    return handleApiError(error);
  }
}
