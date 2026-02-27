const mockIndexPrd = jest.fn();
jest.mock("@/services/search-service", () => ({
  SearchService: jest.fn().mockImplementation(() => ({
    indexPrd: (...args: unknown[]) => mockIndexPrd(...args),
  })),
}));

import { createSavePrdTool } from "../save-prd-tool";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    prdVersion: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const mockedPrisma = jest.mocked(prisma);

describe("save-prd-tool", () => {
  const userId = "user-1";
  const projectId = "project-1";

  beforeEach(() => {
    jest.clearAllMocks();
    mockIndexPrd.mockResolvedValue(undefined);
  });

  it("creates tool with correct name and description", () => {
    const tool = createSavePrdTool(userId, projectId);

    expect(tool.name).toBe("save_prd");
    expect(tool.label).toBeDefined();
    expect(tool.description).toBeDefined();
    expect(tool.parameters).toBeDefined();
  });

  it("execute saves a new PRD and returns success", async () => {
    const tool = createSavePrdTool(userId, projectId);

    const createdPrd = {
      id: "prd-new",
      title: "My PRD",
      currentVersion: 1,
      projectId,
      authorId: userId,
    };
    const createdVersion = {
      id: "ver-1",
      prdId: "prd-new",
      version: 1,
      content: "# My PRD\nSome content",
      changeSummary: "Initial version",
    };

    mockedPrisma.prd.findFirst.mockResolvedValue(null);
    mockedPrisma.$transaction.mockImplementation(async (fn: any) => {
      mockedPrisma.prd.create.mockResolvedValue(createdPrd as any);
      mockedPrisma.prdVersion.create.mockResolvedValue(createdVersion as any);
      return fn(mockedPrisma);
    });

    const result = await tool.execute("call-1", {
      title: "My PRD",
      content: "# My PRD\nSome content",
      changeSummary: "Initial version",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.prdId).toBe("prd-new");
    expect(parsed.version).toBe(1);
  });

  it("execute updates an existing PRD and returns incremented version", async () => {
    const tool = createSavePrdTool(userId, projectId);

    const existingPrd = {
      id: "prd-existing",
      title: "My PRD",
      currentVersion: 2,
      projectId,
      authorId: userId,
    };

    mockedPrisma.prd.findFirst.mockResolvedValue(existingPrd as any);
    mockedPrisma.$transaction.mockImplementation(async (fn: any) => {
      mockedPrisma.prd.update.mockResolvedValue({
        ...existingPrd,
        currentVersion: 3,
      } as any);
      mockedPrisma.prdVersion.create.mockResolvedValue({
        id: "ver-3",
        prdId: "prd-existing",
        version: 3,
      } as any);
      return fn(mockedPrisma);
    });

    const result = await tool.execute("call-2", {
      title: "My PRD",
      content: "# My PRD\nUpdated content",
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.prdId).toBe("prd-existing");
    expect(parsed.version).toBe(3);
  });

  it("execute handles errors gracefully", async () => {
    const tool = createSavePrdTool(userId, projectId);

    mockedPrisma.prd.findFirst.mockRejectedValue(new Error("DB connection failed"));

    const result = await tool.execute("call-3", {
      title: "Fail PRD",
      content: "content",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DB connection failed");
  });
});
