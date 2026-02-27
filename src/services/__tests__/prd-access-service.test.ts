/**
 * PRD Access Service tests.
 *
 * Tests for canAccessPrd, canEditPrd, and isAuthorOrAdmin.
 * Uses mocked Prisma client.
 */

// ---------------------------------------------------------------------------
// Mocks must be declared before imports
// ---------------------------------------------------------------------------

const mockPrdFindUnique = jest.fn();
const mockPrdCoAuthorFindUnique = jest.fn();
const mockProjectMemberFindUnique = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: { findUnique: (...args: unknown[]) => mockPrdFindUnique(...args) },
    prdCoAuthor: {
      findUnique: (...args: unknown[]) => mockPrdCoAuthorFindUnique(...args),
    },
    projectMember: {
      findUnique: (...args: unknown[]) =>
        mockProjectMemberFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  canAccessPrd,
  canEditPrd,
  isAuthorOrAdmin,
} from "../prd-access-service";

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const MOCK_PRD = {
  id: "prd_001",
  authorId: "user_author",
  projectId: "proj_001",
};

// ---------------------------------------------------------------------------
// Tests: canAccessPrd
// ---------------------------------------------------------------------------

describe("canAccessPrd", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrdFindUnique.mockResolvedValue(MOCK_PRD);
    mockUserFindUnique.mockResolvedValue({ id: "user_other", role: "AUTHOR" });
    mockPrdCoAuthorFindUnique.mockResolvedValue(null);
    mockProjectMemberFindUnique.mockResolvedValue(null);
  });

  it("returns true for the PRD author", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user_author",
      role: "AUTHOR",
    });

    const result = await canAccessPrd("user_author", "prd_001");
    expect(result).toBe(true);
  });

  it("returns true for a co-author", async () => {
    mockPrdCoAuthorFindUnique.mockResolvedValue({
      id: "ca_1",
      prdId: "prd_001",
      userId: "user_coauthor",
    });

    const result = await canAccessPrd("user_coauthor", "prd_001");
    expect(result).toBe(true);
  });

  it("returns true for an admin", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user_admin", role: "ADMIN" });

    const result = await canAccessPrd("user_admin", "prd_001");
    expect(result).toBe(true);
  });

  it("returns true for a project member", async () => {
    mockProjectMemberFindUnique.mockResolvedValue({
      id: "pm_1",
      projectId: "proj_001",
      userId: "user_member",
    });

    const result = await canAccessPrd("user_member", "prd_001");
    expect(result).toBe(true);
  });

  it("returns false for a non-member", async () => {
    const result = await canAccessPrd("user_nobody", "prd_001");
    expect(result).toBe(false);
  });

  it("returns false when PRD does not exist", async () => {
    mockPrdFindUnique.mockResolvedValue(null);

    const result = await canAccessPrd("user_author", "prd_nonexistent");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: canEditPrd
// ---------------------------------------------------------------------------

describe("canEditPrd", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrdFindUnique.mockResolvedValue(MOCK_PRD);
    mockUserFindUnique.mockResolvedValue({ id: "user_other", role: "AUTHOR" });
    mockPrdCoAuthorFindUnique.mockResolvedValue(null);
  });

  it("returns true for the PRD author", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user_author",
      role: "AUTHOR",
    });

    const result = await canEditPrd("user_author", "prd_001");
    expect(result).toBe(true);
  });

  it("returns true for a co-author", async () => {
    mockPrdCoAuthorFindUnique.mockResolvedValue({
      id: "ca_1",
      prdId: "prd_001",
      userId: "user_coauthor",
    });

    const result = await canEditPrd("user_coauthor", "prd_001");
    expect(result).toBe(true);
  });

  it("returns true for an admin", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user_admin", role: "ADMIN" });

    const result = await canEditPrd("user_admin", "prd_001");
    expect(result).toBe(true);
  });

  it("returns false for a non-author non-coauthor", async () => {
    const result = await canEditPrd("user_nobody", "prd_001");
    expect(result).toBe(false);
  });

  it("returns false when PRD does not exist", async () => {
    mockPrdFindUnique.mockResolvedValue(null);

    const result = await canEditPrd("user_author", "prd_nonexistent");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: isAuthorOrAdmin
// ---------------------------------------------------------------------------

describe("isAuthorOrAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrdFindUnique.mockResolvedValue(MOCK_PRD);
    mockUserFindUnique.mockResolvedValue({ id: "user_other", role: "AUTHOR" });
  });

  it("returns true for the primary author", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user_author",
      role: "AUTHOR",
    });

    const result = await isAuthorOrAdmin("user_author", "prd_001");
    expect(result).toBe(true);
  });

  it("returns true for an admin", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user_admin", role: "ADMIN" });

    const result = await isAuthorOrAdmin("user_admin", "prd_001");
    expect(result).toBe(true);
  });

  it("returns false for a co-author (not primary)", async () => {
    const result = await isAuthorOrAdmin("user_coauthor", "prd_001");
    expect(result).toBe(false);
  });

  it("returns false when PRD does not exist", async () => {
    mockPrdFindUnique.mockResolvedValue(null);

    const result = await isAuthorOrAdmin("user_author", "prd_nonexistent");
    expect(result).toBe(false);
  });
});
