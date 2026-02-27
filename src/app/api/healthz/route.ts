/**
 * Readiness probe endpoint.
 *
 * Checks connectivity to all critical dependencies:
 * - PostgreSQL (via Prisma)
 * - Redis (via ioredis)
 *
 * Returns 200 if all dependencies are reachable, 503 otherwise.
 */
import Redis from "ioredis";

import { apiSuccess, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

interface HealthStatus {
  status: "ok" | "degraded";
  checks: {
    database: CheckResult;
    redis: CheckResult;
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

export async function GET() {
  try {
    const [database, redis] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);

    const allUp =
      database.status === "up" &&
      redis.status === "up";

    const health: HealthStatus = {
      status: allUp ? "ok" : "degraded",
      checks: { database, redis },
    };

    if (!allUp) {
      return apiSuccess(health, 503);
    }

    return apiSuccess(health);
  } catch (error) {
    return handleApiError(error);
  }
}
