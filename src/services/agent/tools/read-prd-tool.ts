import { Type } from "@sinclair/typebox";
import { prisma } from "@/lib/prisma";
import type { ToolDefinition, ToolResult } from "@/types/pi-sdk";

const ReadPrdParams = Type.Object({
  identifier: Type.String({
    description: "PRD title or ID to look up",
  }),
});

export function createReadPrdTool(
  userId: string,
  projectId: string,
): ToolDefinition {
  return {
    name: "read_prd",
    label: "Read PRD",
    description:
      "Read the full content of a PRD by its title or ID. Returns the latest version.",
    parameters: ReadPrdParams,

    async execute(
      _toolCallId: string,
      params: { identifier: string },
    ): Promise<ToolResult> {
      try {
        const prd = await prisma.prd.findFirst({
          where: {
            projectId,
            authorId: userId,
            OR: [
              { id: params.identifier },
              { title: params.identifier },
            ],
          },
          include: {
            versions: {
              orderBy: { version: "desc" },
              take: 1,
            },
          },
        });

        if (!prd) {
          return {
            content: [
              {
                type: "text",
                text: `PRD not found for identifier: "${params.identifier}"`,
              },
            ],
            isError: true,
          };
        }

        const latestVersion = prd.versions[0];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id: prd.id,
                title: prd.title,
                status: prd.status,
                version: prd.currentVersion,
                content: latestVersion?.content ?? "",
                changeSummary: latestVersion?.changeSummary ?? null,
              }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error reading PRD: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
