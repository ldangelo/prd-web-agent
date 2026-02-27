/**
 * Submit pipeline API route tests.
 *
 * Tests for POST /api/prds/[id]/submit (start pipeline),
 * GET /api/prds/[id]/submit/status (get step statuses),
 * and POST /api/prds/[id]/submit/retry/[step] (retry a step).
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockExecute = jest.fn();
const mockRetryStep = jest.fn();
const mockGetStepStatuses = jest.fn();

jest.mock("@/services/submission-pipeline-service", () => ({
  SubmissionPipelineService: jest.fn().mockImplementation(() => ({
    execute: (...args: unknown[]) => mockExecute(...args),
    retryStep: (...args: unknown[]) => mockRetryStep(...args),
    getStepStatuses: (...args: unknown[]) => mockGetStepStatuses(...args),
  })),
}));

const mockRequireAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { POST } from "../route";
import { GET } from "../status/route";
import { POST as RetryPOST } from "../retry/[step]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  method: string,
  url: string = "http://localhost:3000/api/prds/prd_001/submit",
): NextRequest {
  return new NextRequest(url, { method });
}

async function parseResponse(response: Response) {
  return response.json();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/prds/[id]/submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_001", role: "AUTHOR" },
    });
  });

  it("should start the pipeline and return steps", async () => {
    const mockSteps = [
      { name: "github", status: "success", artifactLink: "https://github.com/org/repo/pull/42" },
    ];
    mockExecute.mockResolvedValue(mockSteps);

    const request = createRequest("POST");
    const response = await POST(request, {
      params: Promise.resolve({ id: "prd_001" }),
    });
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.data.steps).toHaveLength(1);
    expect(body.data.steps[0].name).toBe("github");
    expect(mockExecute).toHaveBeenCalledWith("prd_001", "user_001");
  });

  it("should return 401 when not authenticated", async () => {
    const { UnauthorizedError } = jest.requireActual("@/lib/api/errors") as any;
    mockRequireAuth.mockRejectedValue(new UnauthorizedError("Authentication required"));

    const request = createRequest("POST");

    // The handler catches errors via handleApiError
    const response = await POST(request, {
      params: Promise.resolve({ id: "prd_001" }),
    });

    expect(response.status).toBe(401);
  });

  it("should return error when pipeline fails", async () => {
    const { ApiError } = jest.requireActual("@/lib/api/errors") as any;
    mockExecute.mockRejectedValue(new ApiError("PRD must be in APPROVED status to submit", 422));

    const request = createRequest("POST");
    const response = await POST(request, {
      params: Promise.resolve({ id: "prd_001" }),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

describe("GET /api/prds/[id]/submit/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_001", role: "AUTHOR" },
    });
  });

  it("should return step statuses", async () => {
    const mockStatuses = [
      { name: "github", status: "success", artifactLink: "https://github.com/org/repo/pull/42" },
    ];
    mockGetStepStatuses.mockResolvedValue(mockStatuses);

    const request = createRequest(
      "GET",
      "http://localhost:3000/api/prds/prd_001/submit/status",
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: "prd_001" }),
    });
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.data.steps).toHaveLength(1);
    expect(body.data.steps[0].status).toBe("success");
  });
});

describe("POST /api/prds/[id]/submit/retry/[step]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user_001", role: "AUTHOR" },
    });
  });

  it("should retry a failed step", async () => {
    mockRetryStep.mockResolvedValue({
      name: "git",
      status: "success",
      artifactLink: "https://github.com/pr/1",
    });

    const request = createRequest(
      "POST",
      "http://localhost:3000/api/prds/prd_001/submit/retry/git",
    );
    const response = await RetryPOST(request, {
      params: Promise.resolve({ id: "prd_001", step: "git" }),
    });
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.data.step.name).toBe("git");
    expect(body.data.step.status).toBe("success");
    expect(mockRetryStep).toHaveBeenCalledWith("prd_001", "git", "user_001");
  });
});
