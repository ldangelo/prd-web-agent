import { createReadPrdTool } from "../read-prd-tool";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    prd: {
      findFirst: jest.fn(),
    },
  },
}));

const mockedPrisma = jest.mocked(prisma);

describe("read-prd-tool", () => {
  const userId = "user-1";
  const projectId = "project-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates tool with correct name and description", () => {
    const tool = createReadPrdTool(userId, projectId);

    expect(tool.name).toBe("read_prd");
    expect(tool.label).toBeDefined();
    expect(tool.description).toBeDefined();
  });

  it("returns PRD content when found", async () => {
    const tool = createReadPrdTool(userId, projectId);

    const prd = {
      id: "prd-1",
      title: "Feature Alpha",
      status: "DRAFT",
      currentVersion: 3,
      versions: [
        {
          version: 3,
          content: "# Feature Alpha\n\nThis is the PRD content.",
          changeSummary: "Updated requirements",
          createdAt: new Date("2026-01-15"),
        },
      ],
    };

    mockedPrisma.prd.findFirst.mockResolvedValue(prd as any);

    const result = await tool.execute("call-1", { identifier: "Feature Alpha" });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.title).toBe("Feature Alpha");
    expect(parsed.content).toContain("# Feature Alpha");
    expect(parsed.version).toBe(3);
  });

  it("returns error when PRD not found", async () => {
    const tool = createReadPrdTool(userId, projectId);

    mockedPrisma.prd.findFirst.mockResolvedValue(null);

    const result = await tool.execute("call-2", { identifier: "Nonexistent" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });
});
