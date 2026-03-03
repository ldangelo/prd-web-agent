/**
 * Build the agent prompt for initial PRD creation.
 * Shared between the SSE generate endpoint and the background generator.
 */
export function buildCreatePrompt(description: string): string {
  return [
    `Create a comprehensive PRD for the following product:`,
    ``,
    description,
    ``,
    `Output the complete PRD as well-structured Markdown. Include sections for:`,
    `Summary, Problem Statement, User Analysis, Goals/Non-Goals,`,
    `Functional Requirements, Non-Functional Requirements, and Success Metrics.`,
  ].join("\n");
}
