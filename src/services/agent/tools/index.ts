import type { ToolDefinition } from "@/types/pi-sdk";
import { createSavePrdTool } from "./save-prd-tool";
import { createListPrdsTool } from "./list-prds-tool";
import { createReadPrdTool } from "./read-prd-tool";

export { createSavePrdTool } from "./save-prd-tool";
export { createListPrdsTool } from "./list-prds-tool";
export { createReadPrdTool } from "./read-prd-tool";

/**
 * Create the full set of agent tools for a given user/project context.
 */
export function createAgentTools(
  userId: string,
  projectId: string,
  _prdId?: string,
): ToolDefinition[] {
  return [
    createSavePrdTool(userId, projectId),
    createListPrdsTool(userId, projectId),
    createReadPrdTool(userId, projectId),
  ];
}
