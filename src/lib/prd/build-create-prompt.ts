/**
 * Build the agent prompt for initial PRD creation.
 * Shared between the SSE generate endpoint and the background generator.
 */
export function buildCreatePrompt(
  description: string,
  context?: { userId?: string; projectId?: string },
): string {
  const lines = [
    `Create a comprehensive PRD for the following product:`,
    ``,
    description,
    ``,
    `Output the complete PRD as well-structured Markdown. Include sections for:`,
    `Summary, Problem Statement, User Analysis, Goals/Non-Goals,`,
    `Functional Requirements, Non-Functional Requirements, and Success Metrics.`,
  ];

  if (context?.userId || context?.projectId) {
    lines.push(``);
    lines.push(`## Session Context`);
    if (context.userId) lines.push(`userId: ${context.userId}`);
    if (context.projectId) lines.push(`projectId: ${context.projectId}`);
  }

  return lines.join("\n");
}
