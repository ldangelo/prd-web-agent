import { metrics, Counter, Histogram } from "@opentelemetry/api";

const METER_NAME = "prd-web-agent";

/**
 * Returns the shared OpenTelemetry Meter for the application.
 *
 * Safe to call without an active SDK — the API returns a no-op meter.
 */
function getMeter() {
  return metrics.getMeter(METER_NAME);
}

// ---------------------------------------------------------------------------
// TASK-048: Custom OTel Metrics
// ---------------------------------------------------------------------------

/**
 * Observable gauge that reports the count of PRDs by status.
 *
 * Register a callback via `addCallback` to supply current counts.
 * Labels: { status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "SUBMITTED" }
 */
export const prdCountByStatus = getMeter().createObservableGauge(
  "prd_count_by_status",
  {
    description: "Number of PRDs grouped by status",
    unit: "{prd}",
  },
);

/**
 * Observable gauge tracking the number of active agent sessions.
 *
 * Register a callback via `addCallback` to supply the current count.
 */
export const agentSessionActive = getMeter().createObservableGauge(
  "agent_session_active",
  {
    description: "Number of currently active agent sessions",
    unit: "{session}",
  },
);

/**
 * Counter for idle session evictions.
 */
export const agentSessionIdleEvictionsTotal: Counter =
  getMeter().createCounter("agent_session_idle_evictions_total", {
    description: "Total number of agent sessions evicted due to idle timeout",
    unit: "{eviction}",
  });

/**
 * Histogram recording the end-to-end duration of the submission pipeline.
 */
export const submissionPipelineDuration: Histogram =
  getMeter().createHistogram("submission_pipeline_duration", {
    description: "Duration of the PRD submission pipeline in milliseconds",
    unit: "ms",
  });

/**
 * Counter for successful submission pipeline steps.
 *
 * Labels: { step: string }
 */
export const submissionStepSuccessTotal: Counter = getMeter().createCounter(
  "submission_step_success_total",
  {
    description: "Total number of successful submission pipeline steps",
    unit: "{step}",
  },
);
