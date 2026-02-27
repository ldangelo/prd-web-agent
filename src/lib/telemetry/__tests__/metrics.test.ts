// ---------------------------------------------------------------------------
// Mock @opentelemetry/api before importing the metrics module.
// ---------------------------------------------------------------------------

const mockAdd = jest.fn();
const mockRecord = jest.fn();
const mockAddCallback = jest.fn();

const mockCreateCounter = jest.fn(() => ({ add: mockAdd }));
const mockCreateHistogram = jest.fn(() => ({ record: mockRecord }));
const mockCreateObservableGauge = jest.fn(() => ({
  addCallback: mockAddCallback,
}));

jest.mock("@opentelemetry/api", () => ({
  metrics: {
    getMeter: () => ({
      createCounter: mockCreateCounter,
      createHistogram: mockCreateHistogram,
      createObservableGauge: mockCreateObservableGauge,
    }),
  },
}));

import {
  prdCountByStatus,
  agentSessionActive,
  agentSessionIdleEvictionsTotal,
  submissionPipelineDuration,
  submissionStepSuccessTotal,
} from "@/lib/telemetry/metrics";

describe("TASK-048: Custom OTel Metrics", () => {
  // -----------------------------------------------------------------------
  // prd_count_by_status — observable gauge
  // -----------------------------------------------------------------------

  describe("prdCountByStatus", () => {
    it("should be created as an observable gauge with correct name", () => {
      expect(mockCreateObservableGauge).toHaveBeenCalledWith(
        "prd_count_by_status",
        expect.objectContaining({
          description: expect.any(String),
        }),
      );
    });

    it("should expose addCallback for registering observers", () => {
      expect(typeof prdCountByStatus.addCallback).toBe("function");
    });
  });

  // -----------------------------------------------------------------------
  // agent_session_active — observable gauge
  // -----------------------------------------------------------------------

  describe("agentSessionActive", () => {
    it("should be created as an observable gauge with correct name", () => {
      expect(mockCreateObservableGauge).toHaveBeenCalledWith(
        "agent_session_active",
        expect.objectContaining({
          description: expect.any(String),
        }),
      );
    });

    it("should expose addCallback for registering observers", () => {
      expect(typeof agentSessionActive.addCallback).toBe("function");
    });
  });

  // -----------------------------------------------------------------------
  // agent_session_idle_evictions_total — counter
  // -----------------------------------------------------------------------

  describe("agentSessionIdleEvictionsTotal", () => {
    it("should be created as a counter with correct name", () => {
      expect(mockCreateCounter).toHaveBeenCalledWith(
        "agent_session_idle_evictions_total",
        expect.objectContaining({
          description: expect.any(String),
        }),
      );
    });

    it("should expose add method", () => {
      agentSessionIdleEvictionsTotal.add(1);
      expect(mockAdd).toHaveBeenCalledWith(1);
    });
  });

  // -----------------------------------------------------------------------
  // submission_pipeline_duration — histogram
  // -----------------------------------------------------------------------

  describe("submissionPipelineDuration", () => {
    it("should be created as a histogram with correct name", () => {
      expect(mockCreateHistogram).toHaveBeenCalledWith(
        "submission_pipeline_duration",
        expect.objectContaining({
          description: expect.any(String),
          unit: "ms",
        }),
      );
    });

    it("should expose record method", () => {
      submissionPipelineDuration.record(1500);
      expect(mockRecord).toHaveBeenCalledWith(1500);
    });
  });

  // -----------------------------------------------------------------------
  // submission_step_success_total — counter (label: step)
  // -----------------------------------------------------------------------

  describe("submissionStepSuccessTotal", () => {
    it("should be created as a counter with correct name", () => {
      expect(mockCreateCounter).toHaveBeenCalledWith(
        "submission_step_success_total",
        expect.objectContaining({
          description: expect.any(String),
        }),
      );
    });

    it("should accept step label when adding", () => {
      submissionStepSuccessTotal.add(1, { step: "validate" });
      expect(mockAdd).toHaveBeenCalledWith(1, { step: "validate" });
    });
  });
});
