/**
 * End-to-end Integration Tests.
 *
 * Tests the full PRD lifecycle flow through API route handlers:
 * login -> create project -> create PRD -> version -> review -> comment ->
 * approve -> submit. Also tests auth enforcement, comment threads, and search.
 *
 * @jest-environment node
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

// --- Prisma mock fns ---
const mockProjectCreate = jest.fn();
const mockProjectFindUnique = jest.fn();
const mockProjectFindMany = jest.fn();
const mockProjectMemberFindUnique = jest.fn();
const mockProjectMemberFindMany = jest.fn();
const mockPrdCreate = jest.fn();
const mockPrdFindUnique = jest.fn();
const mockPrdFindMany = jest.fn();
const mockPrdCount = jest.fn();
const mockPrdUpdate = jest.fn();
const mockPrdVersionCreate = jest.fn();
const mockPrdVersionFindMany = jest.fn();
const mockPrdVersionFindFirst = jest.fn();
const mockCommentCreate = jest.fn();
const mockCommentFindMany = jest.fn();
const mockCommentFindUnique = jest.fn();
const mockCommentUpdate = jest.fn();
const mockCommentCount = jest.fn();
const mockUserFindUnique = jest.fn();
const mockPrdCoAuthorFindFirst = jest.fn();
const mockPrdCoAuthorFindUnique = jest.fn();
const mockNotificationCreateMany = jest.fn();
const mockGlobalSettingsFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      create: (...args: unknown[]) => mockProjectCreate(...args),
      findUnique: (...args: unknown[]) => mockProjectFindUnique(...args),
      findMany: (...args: unknown[]) => mockProjectFindMany(...args),
    },
    projectMember: {
      findUnique: (...args: unknown[]) => mockProjectMemberFindUnique(...args),
      findMany: (...args: unknown[]) => mockProjectMemberFindMany(...args),
    },
    prd: {
      create: (...args: unknown[]) => mockPrdCreate(...args),
      findUnique: (...args: unknown[]) => mockPrdFindUnique(...args),
      findMany: (...args: unknown[]) => mockPrdFindMany(...args),
      count: (...args: unknown[]) => mockPrdCount(...args),
      update: (...args: unknown[]) => mockPrdUpdate(...args),
    },
    prdVersion: {
      create: (...args: unknown[]) => mockPrdVersionCreate(...args),
      findMany: (...args: unknown[]) => mockPrdVersionFindMany(...args),
      findFirst: (...args: unknown[]) => mockPrdVersionFindFirst(...args),
    },
    comment: {
      create: (...args: unknown[]) => mockCommentCreate(...args),
      findMany: (...args: unknown[]) => mockCommentFindMany(...args),
      findUnique: (...args: unknown[]) => mockCommentFindUnique(...args),
      update: (...args: unknown[]) => mockCommentUpdate(...args),
      count: (...args: unknown[]) => mockCommentCount(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    prdCoAuthor: {
      findFirst: (...args: unknown[]) => mockPrdCoAuthorFindFirst(...args),
      findUnique: (...args: unknown[]) => mockPrdCoAuthorFindUnique(...args),
    },
    notification: {
      createMany: (...args: unknown[]) => mockNotificationCreateMany(...args),
    },
    globalSettings: {
      findUnique: (...args: unknown[]) => mockGlobalSettingsFindUnique(...args),
    },
  },
}));

// --- Auth mocks ---
const mockRequireAuth = jest.fn();
const mockRequireAdmin = jest.fn();

jest.mock("@/lib/auth", () => ({
  requireAuth: () => mockRequireAuth(),
  requireAdmin: () => mockRequireAdmin(),
}));

// --- Service mocks ---
const mockCanAccessPrd = jest.fn();
jest.mock("@/services/prd-access-service", () => ({
  canAccessPrd: (...args: unknown[]) => mockCanAccessPrd(...args),
}));

const mockListComments = jest.fn();
const mockCreateComment = jest.fn();
const mockResolveComment = jest.fn();
jest.mock("@/services/comment-service", () => ({
  listComments: (...args: unknown[]) => mockListComments(...args),
  createComment: (...args: unknown[]) => mockCreateComment(...args),
  resolveComment: (...args: unknown[]) => mockResolveComment(...args),
}));

const mockStatusWorkflowTransition = jest.fn();
const mockGetValidTransitions = jest.fn();
jest.mock("@/services/status-workflow-service", () => ({
  StatusWorkflowService: jest.fn().mockImplementation(() => ({
    transition: (...args: unknown[]) => mockStatusWorkflowTransition(...args),
    getValidTransitions: (...args: unknown[]) => mockGetValidTransitions(...args),
  })),
}));

const mockSubmissionExecute = jest.fn();
jest.mock("@/services/submission-pipeline-service", () => ({
  SubmissionPipelineService: jest.fn().mockImplementation(() => ({
    execute: (...args: unknown[]) => mockSubmissionExecute(...args),
  })),
}));

const mockSearchPrds = jest.fn();
jest.mock("@/services/search-service", () => ({
  SearchService: jest.fn().mockImplementation(() => ({
    searchPrds: (...args: unknown[]) => mockSearchPrds(...args),
  })),
}));

const mockLogTransition = jest.fn();
jest.mock("@/services/audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    logTransition: (...args: unknown[]) => mockLogTransition(...args),
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  POST as createProject,
  GET as listProjects,
} from "@/app/api/projects/route";
import {
  POST as createPrd,
  GET as listPrds,
} from "@/app/api/prds/route";
import { POST as transitionStatus } from "@/app/api/prds/[id]/status/route";
import {
  POST as postComment,
  GET as getComments,
} from "@/app/api/prds/[id]/comments/route";
import { PUT as resolveCommentRoute } from "@/app/api/prds/[id]/comments/[commentId]/resolve/route";
import { POST as submitPrd } from "@/app/api/prds/[id]/submit/route";
import { GET as getVersions } from "@/app/api/prds/[id]/versions/route";
import { GET as searchRoute } from "@/app/api/search/route";
import {
  UnauthorizedError,
  ForbiddenError,
} from "@/lib/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  url: string,
  method: string = "GET",
  body?: Record<string, unknown>,
): Request {
  const opts: RequestInit = { method };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  return new Request(url, opts);
}

function makeParams<T extends Record<string, string>>(
  values: T,
): { params: Promise<T> } {
  return { params: Promise.resolve(values) };
}

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const ADMIN_SESSION = {
  user: { id: "user_admin", email: "admin@example.com", role: "ADMIN" },
};

const AUTHOR_SESSION = {
  user: { id: "user_author", email: "author@example.com", role: "AUTHOR" },
};

const REVIEWER_SESSION = {
  user: { id: "user_reviewer", email: "reviewer@example.com", role: "REVIEWER" },
};

const MOCK_PROJECT = {
  id: "proj_001",
  name: "E2E Test Project",
  description: "Integration test project",
  githubRepo: "org/repo",
  defaultLabels: ["prd"],
  defaultReviewers: ["reviewer1"],
  createdAt: new Date("2026-02-26T00:00:00.000Z"),
  updatedAt: new Date("2026-02-26T00:00:00.000Z"),
};

const MOCK_PRD = {
  id: "prd_001",
  title: "E2E Test PRD",
  projectId: "proj_001",
  authorId: "user_author",
  status: "DRAFT",
  currentVersion: 1,
  githubPrUrl: null,
  githubPrNumber: null,
  githubBranch: null,
  createdAt: new Date("2026-02-26T00:00:00.000Z"),
  updatedAt: new Date("2026-02-26T00:00:00.000Z"),
};

const MOCK_VERSION = {
  id: "ver_001",
  prdId: "prd_001",
  version: 1,
  content: "# PRD Content\n\nInitial version.",
  authorId: "user_author",
  changeSummary: "Initial version",
  createdAt: new Date("2026-02-26T00:00:00.000Z"),
};

const MOCK_COMMENT = {
  id: "comment_001",
  prdId: "prd_001",
  authorId: "user_reviewer",
  parentId: null,
  body: "Please clarify the scope.",
  resolved: false,
  resolvedBy: null,
  createdAt: new Date("2026-02-26T01:00:00.000Z"),
  updatedAt: new Date("2026-02-26T01:00:00.000Z"),
  author: {
    id: "user_reviewer",
    name: "Reviewer",
    email: "reviewer@example.com",
    avatarUrl: null,
  },
};

const MOCK_REPLY = {
  id: "comment_002",
  prdId: "prd_001",
  authorId: "user_author",
  parentId: "comment_001",
  body: "Scope is limited to auth module.",
  resolved: false,
  resolvedBy: null,
  createdAt: new Date("2026-02-26T02:00:00.000Z"),
  updatedAt: new Date("2026-02-26T02:00:00.000Z"),
  author: {
    id: "user_author",
    name: "Author",
    email: "author@example.com",
    avatarUrl: null,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("E2E: Full PRD Lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default global settings
    mockGlobalSettingsFindUnique.mockResolvedValue({
      id: "global",
      blockApprovalOnUnresolvedComments: true,
    });

    // Default: no unresolved comments
    mockCommentCount.mockResolvedValue(0);

    // Default: notifications succeed
    mockNotificationCreateMany.mockResolvedValue({ count: 0 });
  });

  it("should complete the full lifecycle: create project -> create PRD -> version -> IN_REVIEW -> comment -> resolve -> APPROVED -> submit -> SUBMITTED", async () => {
    // -----------------------------------------------------------------
    // Step 1: Create a project (admin)
    // -----------------------------------------------------------------
    mockRequireAuth.mockResolvedValue(ADMIN_SESSION);
    mockProjectCreate.mockResolvedValue(MOCK_PROJECT);

    const projectReq = makeRequest(
      "http://localhost/api/projects",
      "POST",
      { name: "E2E Test Project", description: "Integration test project", githubRepo: "org/repo" },
    );
    const projectRes = await createProject(projectReq as any);
    const projectBody = await projectRes.json();

    expect(projectRes.status).toBe(201);
    expect(projectBody.data).toHaveProperty("id", "proj_001");
    expect(projectBody.data).toHaveProperty("name", "E2E Test Project");

    // -----------------------------------------------------------------
    // Step 2: Create a PRD (author)
    // -----------------------------------------------------------------
    mockRequireAuth.mockResolvedValue(AUTHOR_SESSION);
    mockProjectFindUnique.mockResolvedValue(MOCK_PROJECT);
    mockProjectMemberFindUnique.mockResolvedValue({
      id: "pm_1",
      projectId: "proj_001",
      userId: "user_author",
    });
    mockPrdCreate.mockResolvedValue(MOCK_PRD);

    const prdReq = makeRequest(
      "http://localhost/api/prds",
      "POST",
      { projectId: "proj_001", description: "E2E Test PRD" },
    );
    const prdRes = await createPrd(prdReq as any);
    const prdBody = await prdRes.json();

    expect(prdRes.status).toBe(201);
    expect(prdBody.data).toHaveProperty("prdId", "prd_001");

    // -----------------------------------------------------------------
    // Step 3: Create a version
    // -----------------------------------------------------------------
    mockPrdFindUnique.mockResolvedValue(MOCK_PRD);
    mockPrdVersionFindMany.mockResolvedValue([MOCK_VERSION]);

    const versionsReq = makeRequest("http://localhost/api/prds/prd_001/versions");
    const versionsRes = await getVersions(
      versionsReq as any,
      { params: { id: "prd_001" } } as any,
    );
    const versionsBody = await versionsRes.json();

    expect(versionsRes.status).toBe(200);
    expect(versionsBody.data).toHaveLength(1);
    expect(versionsBody.data[0]).toHaveProperty("version", 1);

    // -----------------------------------------------------------------
    // Step 4: Transition to IN_REVIEW
    // -----------------------------------------------------------------
    mockRequireAuth.mockResolvedValue(AUTHOR_SESSION);
    mockStatusWorkflowTransition.mockResolvedValue(undefined);

    const toReviewReq = makeRequest(
      "http://localhost/api/prds/prd_001/status",
      "POST",
      { to: "IN_REVIEW" },
    );
    const toReviewRes = await transitionStatus(
      toReviewReq as any,
      makeParams({ id: "prd_001" }),
    );
    const toReviewBody = await toReviewRes.json();

    expect(toReviewRes.status).toBe(200);
    expect(toReviewBody.data).toMatchObject({
      prdId: "prd_001",
      status: "IN_REVIEW",
    });
    expect(mockStatusWorkflowTransition).toHaveBeenCalledWith(
      "prd_001",
      "user_author",
      "IN_REVIEW",
      undefined,
    );

    // -----------------------------------------------------------------
    // Step 5: Add a review comment
    // -----------------------------------------------------------------
    mockRequireAuth.mockResolvedValue(REVIEWER_SESSION);
    mockPrdFindUnique.mockResolvedValue({
      ...MOCK_PRD,
      status: "IN_REVIEW",
    });
    mockCanAccessPrd.mockResolvedValue(true);
    mockCreateComment.mockResolvedValue(MOCK_COMMENT);

    const commentReq = makeRequest(
      "http://localhost/api/prds/prd_001/comments",
      "POST",
      { body: "Please clarify the scope." },
    );
    const commentRes = await postComment(
      commentReq as any,
      makeParams({ id: "prd_001" }),
    );
    const commentBody = await commentRes.json();

    expect(commentRes.status).toBe(201);
    expect(commentBody.data).toHaveProperty("id", "comment_001");
    expect(commentBody.data).toHaveProperty("body", "Please clarify the scope.");

    // -----------------------------------------------------------------
    // Step 6: Resolve the comment
    // -----------------------------------------------------------------
    mockRequireAuth.mockResolvedValue(AUTHOR_SESSION);
    mockResolveComment.mockResolvedValue({
      ...MOCK_COMMENT,
      resolved: true,
      resolvedBy: "user_author",
    });

    const resolveReq = makeRequest(
      "http://localhost/api/prds/prd_001/comments/comment_001/resolve",
      "PUT",
    );
    const resolveRes = await resolveCommentRoute(
      resolveReq as any,
      makeParams({ id: "prd_001", commentId: "comment_001" }),
    );
    const resolveBody = await resolveRes.json();

    expect(resolveRes.status).toBe(200);
    expect(resolveBody.data).toHaveProperty("resolved", true);
    expect(resolveBody.data).toHaveProperty("resolvedBy", "user_author");

    // -----------------------------------------------------------------
    // Step 7: Transition to APPROVED (reviewer)
    // -----------------------------------------------------------------
    mockRequireAuth.mockResolvedValue(REVIEWER_SESSION);
    mockStatusWorkflowTransition.mockResolvedValue(undefined);

    const toApprovedReq = makeRequest(
      "http://localhost/api/prds/prd_001/status",
      "POST",
      { to: "APPROVED" },
    );
    const toApprovedRes = await transitionStatus(
      toApprovedReq as any,
      makeParams({ id: "prd_001" }),
    );
    const toApprovedBody = await toApprovedRes.json();

    expect(toApprovedRes.status).toBe(200);
    expect(toApprovedBody.data).toMatchObject({
      prdId: "prd_001",
      status: "APPROVED",
    });
    expect(mockStatusWorkflowTransition).toHaveBeenCalledWith(
      "prd_001",
      "user_reviewer",
      "APPROVED",
      undefined,
    );

    // -----------------------------------------------------------------
    // Step 8: Submit (triggers pipeline with mocked integrations)
    // -----------------------------------------------------------------
    mockRequireAuth.mockResolvedValue(AUTHOR_SESSION);
    mockSubmissionExecute.mockResolvedValue([
      { name: "github", status: "success", artifactLink: "https://github.com/org/repo/pull/42" },
    ]);

    const submitReq = makeRequest(
      "http://localhost/api/prds/prd_001/submit",
      "POST",
    );
    const submitRes = await submitPrd(
      submitReq as any,
      makeParams({ id: "prd_001" }),
    );
    const submitBody = await submitRes.json();

    expect(submitRes.status).toBe(200);
    expect(submitBody.data).toHaveProperty("prdId", "prd_001");
    expect(submitBody.data.steps).toHaveLength(1);
    expect(submitBody.data.steps[0]).toMatchObject({
      name: "github",
      status: "success",
      artifactLink: "https://github.com/org/repo/pull/42",
    });

    // Verify the pipeline was called with correct args
    expect(mockSubmissionExecute).toHaveBeenCalledWith(
      "prd_001",
      "user_author",
    );
  });
});

// ---------------------------------------------------------------------------
// Auth flow tests
// ---------------------------------------------------------------------------

describe("E2E: Auth Flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 for unauthenticated request to create PRD", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const req = makeRequest(
      "http://localhost/api/prds",
      "POST",
      { projectId: "proj_001" },
    );
    const res = await createPrd(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("Authentication required");
  });

  it("should return 401 for unauthenticated request to list projects", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const req = makeRequest("http://localhost/api/projects");
    const res = await listProjects(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("should return 401 for unauthenticated status transition", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const req = makeRequest(
      "http://localhost/api/prds/prd_001/status",
      "POST",
      { to: "IN_REVIEW" },
    );
    const res = await transitionStatus(
      req as any,
      makeParams({ id: "prd_001" }),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("should return 401 for unauthenticated submission", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const req = makeRequest(
      "http://localhost/api/prds/prd_001/submit",
      "POST",
    );
    const res = await submitPrd(
      req as any,
      makeParams({ id: "prd_001" }),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("should return 401 when unauthenticated user tries to create a project", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const req = makeRequest(
      "http://localhost/api/projects",
      "POST",
      { name: "Unauthorized Project", githubRepo: "org/repo" },
    );
    const res = await createProject(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("Authentication required");
  });

  it("should return 403 when user is not a project member and tries to create PRD", async () => {
    mockRequireAuth.mockResolvedValue(AUTHOR_SESSION);
    mockProjectFindUnique.mockResolvedValue(MOCK_PROJECT);
    mockProjectMemberFindUnique.mockResolvedValue(null);

    const req = makeRequest(
      "http://localhost/api/prds",
      "POST",
      { projectId: "proj_001" },
    );
    const res = await createPrd(req as any);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain("not a member");
  });

  it("should return 401 for unauthenticated search", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const req = makeRequest("http://localhost/api/search?q=test");
    const res = await searchRoute(req as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// Comment thread tests
// ---------------------------------------------------------------------------

describe("E2E: Comment Threads", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAuth.mockResolvedValue(REVIEWER_SESSION);
    mockPrdFindUnique.mockResolvedValue({
      ...MOCK_PRD,
      status: "IN_REVIEW",
    });
    mockCanAccessPrd.mockResolvedValue(true);
  });

  it("should create a parent comment, reply, and resolve the thread", async () => {
    // Step 1: Create parent comment
    mockCreateComment.mockResolvedValue(MOCK_COMMENT);

    const parentReq = makeRequest(
      "http://localhost/api/prds/prd_001/comments",
      "POST",
      { body: "Please clarify the scope." },
    );
    const parentRes = await postComment(
      parentReq as any,
      makeParams({ id: "prd_001" }),
    );
    const parentBody = await parentRes.json();

    expect(parentRes.status).toBe(201);
    expect(parentBody.data).toHaveProperty("id", "comment_001");
    expect(parentBody.data).toHaveProperty("parentId", null);

    // Step 2: Reply to the parent comment
    mockRequireAuth.mockResolvedValue(AUTHOR_SESSION);
    mockCreateComment.mockResolvedValue(MOCK_REPLY);

    const replyReq = makeRequest(
      "http://localhost/api/prds/prd_001/comments",
      "POST",
      { body: "Scope is limited to auth module.", parentId: "comment_001" },
    );
    const replyRes = await postComment(
      replyReq as any,
      makeParams({ id: "prd_001" }),
    );
    const replyBody = await replyRes.json();

    expect(replyRes.status).toBe(201);
    expect(replyBody.data).toHaveProperty("id", "comment_002");
    expect(replyBody.data).toHaveProperty("parentId", "comment_001");

    // Step 3: Verify the createComment mock was called with parentId
    expect(mockCreateComment).toHaveBeenLastCalledWith(
      "prd_001",
      "user_author",
      "Scope is limited to auth module.",
      "comment_001",
    );

    // Step 4: List comments (threaded)
    mockListComments.mockResolvedValue([
      {
        ...MOCK_COMMENT,
        replies: [MOCK_REPLY],
      },
    ]);

    const listReq = makeRequest("http://localhost/api/prds/prd_001/comments");
    const listRes = await getComments(
      listReq as any,
      makeParams({ id: "prd_001" }),
    );
    const listBody = await listRes.json();

    expect(listRes.status).toBe(200);
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0].replies).toHaveLength(1);
    expect(listBody.data[0].replies[0].id).toBe("comment_002");

    // Step 5: Resolve the thread
    mockResolveComment.mockResolvedValue({
      ...MOCK_COMMENT,
      resolved: true,
      resolvedBy: "user_author",
    });

    const resolveReq = makeRequest(
      "http://localhost/api/prds/prd_001/comments/comment_001/resolve",
      "PUT",
    );
    const resolveRes = await resolveCommentRoute(
      resolveReq as any,
      makeParams({ id: "prd_001", commentId: "comment_001" }),
    );
    const resolveBody = await resolveRes.json();

    expect(resolveRes.status).toBe(200);
    expect(resolveBody.data).toHaveProperty("resolved", true);
    expect(resolveBody.data).toHaveProperty("resolvedBy", "user_author");
  });

  it("should return 401 when unauthenticated user tries to comment", async () => {
    mockRequireAuth.mockRejectedValue(
      new UnauthorizedError("Authentication required"),
    );

    const req = makeRequest(
      "http://localhost/api/prds/prd_001/comments",
      "POST",
      { body: "Unauthenticated comment" },
    );
    const res = await postComment(
      req as any,
      makeParams({ id: "prd_001" }),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toHaveProperty("error");
  });

  it("should return 403 when user lacks access to the PRD", async () => {
    mockRequireAuth.mockResolvedValue(AUTHOR_SESSION);
    mockCanAccessPrd.mockResolvedValue(false);

    const req = makeRequest(
      "http://localhost/api/prds/prd_001/comments",
      "POST",
      { body: "No access comment" },
    );
    const res = await postComment(
      req as any,
      makeParams({ id: "prd_001" }),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// Search tests
// ---------------------------------------------------------------------------

describe("E2E: Search", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireAuth.mockResolvedValue(AUTHOR_SESSION);
  });

  it("should return search results for a valid query", async () => {
    mockSearchPrds.mockResolvedValue({
      total: 2,
      hits: [
        {
          id: "prd_001",
          score: 2.5,
          title: "Authentication Flow PRD",
          content: "Describes authentication...",
          projectId: "proj_001",
          authorId: "user_author",
          status: "DRAFT",
          tags: ["auth", "security"],
          version: 1,
          highlight: {
            title: ["<em>Authentication</em> Flow PRD"],
          },
        },
        {
          id: "prd_002",
          score: 1.2,
          title: "API Gateway PRD",
          content: "Describes the API gateway...",
          projectId: "proj_001",
          authorId: "user_author",
          status: "IN_REVIEW",
          tags: ["api"],
          version: 2,
          highlight: {
            content: ["Describes the <em>API</em> gateway..."],
          },
        },
      ],
    });

    const req = makeRequest("http://localhost/api/search?q=authentication");
    const res = await searchRoute(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveProperty("total", 2);
    expect(body.data.hits).toHaveLength(2);
    expect(body.data.hits[0]).toHaveProperty("title", "Authentication Flow PRD");
    expect(body.data.hits[0]).toHaveProperty("highlight");
  });

  it("should pass filters to the search service", async () => {
    mockSearchPrds.mockResolvedValue({ total: 0, hits: [] });

    const req = makeRequest(
      "http://localhost/api/search?q=test&project=proj_001&status=DRAFT&from=2026-01-01&to=2026-12-31",
    );
    const res = await searchRoute(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockSearchPrds).toHaveBeenCalledWith("test", {
      projectId: "proj_001",
      status: "DRAFT",
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("should return 400 when query parameter is missing", async () => {
    const req = makeRequest("http://localhost/api/search");
    const res = await searchRoute(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("should return 400 when query parameter is empty", async () => {
    const req = makeRequest("http://localhost/api/search?q=");
    const res = await searchRoute(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("should return empty results when no matches found", async () => {
    mockSearchPrds.mockResolvedValue({ total: 0, hits: [] });

    const req = makeRequest(
      "http://localhost/api/search?q=nonexistent_content_xyz",
    );
    const res = await searchRoute(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveProperty("total", 0);
    expect(body.data.hits).toHaveLength(0);
  });
});
