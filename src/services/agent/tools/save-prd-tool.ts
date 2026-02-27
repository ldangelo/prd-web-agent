import { Type } from "@sinclair/typebox";
import { prisma } from "@/lib/prisma";
import type { ToolDefinition, ToolResult } from "@/types/pi-sdk";

const SavePrdParams = Type.Object({
  title: Type.String({ description: "Title of the PRD" }),
  content: Type.String({ description: "Full markdown content of the PRD" }),
  changeSummary: Type.Optional(
    Type.String({ description: "Summary of changes for this version" }),
  ),
});

export function createSavePrdTool(
  userId: string,
  projectId: string,
): ToolDefinition {
  return {
    name: "save_prd",
    label: "Save PRD",
    description:
      "Save or update a PRD document. Creates a new PRD if one with the given title does not exist, otherwise creates a new version.",
    parameters: SavePrdParams,

    async execute(
      _toolCallId: string,
      params: { title: string; content: string; changeSummary?: string },
    ): Promise<ToolResult> {
      try {
        const existing = await prisma.prd.findFirst({
          where: { title: params.title, projectId, authorId: userId },
        });

        let prdId: string;
        let version: number;

        if (existing) {
          const nextVersion = existing.currentVersion + 1;

          await prisma.$transaction(async (tx) => {
            await tx.prd.update({
              where: { id: existing.id },
              data: { currentVersion: nextVersion },
            });
            await tx.prdVersion.create({
              data: {
                prdId: existing.id,
                version: nextVersion,
                content: params.content,
                changeSummary: params.changeSummary ?? null,
                authorId: userId,
              },
            });
          });

          prdId = existing.id;
          version = nextVersion;
        } else {
          const result = await prisma.$transaction(async (tx) => {
            const prd = await tx.prd.create({
              data: {
                title: params.title,
                projectId,
                authorId: userId,
                currentVersion: 1,
              },
            });
            await tx.prdVersion.create({
              data: {
                prdId: prd.id,
                version: 1,
                content: params.content,
                changeSummary: params.changeSummary ?? null,
                authorId: userId,
              },
            });
            return prd;
          });

          prdId = result.id;
          version = 1;
        }

        // TODO: trigger OpenSearch indexing (stub)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ prdId, version }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error saving PRD: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
