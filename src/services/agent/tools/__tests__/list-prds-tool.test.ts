import { createListPrdsTool } from "../list-prds-tool";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findMany: jest.fn(),
    },
  },
}));

const mockedPrisma = jest.mocked(prisma);

describe("list-prds-tool", () => {
  const userId = "user-1";
  const projectId = "project-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates tool with correct name and description", () => {
    const tool = createListPrdsTool(userId, projectId);

    expect(tool.name).toBe("list_prds");
    expect(tool.label).toBeDefined();
    expect(tool.description).toBeDefined();
  });

  it("returns formatted PRD list", async () => {
    const tool = createListPrdsTool(userId, projectId);

    const prds = [
      {
        id: "prd-1",
        title: "Feature Alpha",
        status: "DRAFT",
        currentVersion: 2,
        updatedAt: new Date("2026-01-01"),
      },
      {
        id: "prd-2",
        title: "Feature Beta",
        status: "APPROVED",
        currentVersion: 5,
        updatedAt: new Date("2026-02-01"),
      },
    ];

    mockedPrisma.prd.findMany.mockResolvedValue(prds as any);

    const result = await tool.execute("call-1", {});

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.prds).toHaveLength(2);
    expect(parsed.prds[0].title).toBe("Feature Alpha");
    expect(parsed.prds[1].title).toBe("Feature Beta");
  });

  it('returns "No PRDs found" when empty', async () => {
    const tool = createListPrdsTool(userId, projectId);

    mockedPrisma.prd.findMany.mockResolvedValue([]);

    const result = await tool.execute("call-2", {});

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.prds).toHaveLength(0);
    expect(parsed.message).toBe("No PRDs found");
  });

  it("passes search filter to query", async () => {
    const tool = createListPrdsTool(userId, projectId);

    mockedPrisma.prd.findMany.mockResolvedValue([]);

    await tool.execute("call-3", { search: "alpha" });

    expect(mockedPrisma.prd.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: expect.objectContaining({ contains: "alpha" }),
        }),
      }),
    );
  });
});
