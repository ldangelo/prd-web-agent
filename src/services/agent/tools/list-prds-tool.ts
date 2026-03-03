import { Type } from "@sinclair/typebox";
import { prisma } from "@/lib/prisma";
import type { ToolDefinition, ToolResult } from "@/types/pi-sdk";

const ListPrdsParams = Type.Object({
  search: Type.Optional(
    Type.String({ description: "Search PRDs by title (case-insensitive)" }),
  ),
  projectId: Type.Optional(
    Type.String({ description: "Filter by project ID" }),
  ),
});

export function createListPrdsTool(
  userId: string,
  defaultProjectId: string,
): ToolDefinition {
  return {
    name: "list_prds",
    label: "List PRDs",
    description:
      "List PRD documents the current user has access to, optionally filtered by search term or project.",
    parameters: ListPrdsParams,

    async execute(
      _toolCallId: string,
      params: { search?: string; projectId?: string },
    ): Promise<ToolResult> {
      try {
        const targetProjectId = params.projectId ?? defaultProjectId;

        const where: any = {
          projectId: targetProjectId,
          authorId: userId,
          isDeleted: false,
        };

        if (params.search) {
          where.title = { contains: params.search, mode: "insensitive" };
        }

        const prds = await prisma.prd.findMany({
          where,
          select: {
            id: true,
            title: true,
            status: true,
            currentVersion: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
        });

        const formatted = prds.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          version: p.currentVersion,
          updatedAt: p.updatedAt,
        }));

        const message = prds.length === 0 ? "No PRDs found" : undefined;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ prds: formatted, ...(message && { message }) }),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing PRDs: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
