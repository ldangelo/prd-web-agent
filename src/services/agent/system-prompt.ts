/**
 * System prompt builder for PRD agent sessions.
 *
 * Generates mode-specific system prompts that instruct the AI on how to
 * behave when creating or refining a PRD document.
 */

const BASE_CAPABILITIES = [
  "You are a Product Requirements Document (PRD) specialist.",
  "You help product managers and engineers create clear, comprehensive PRDs.",
  "You follow best practices for requirements engineering.",
  "You ask clarifying questions when requirements are ambiguous.",
  "You structure documents with clear sections: Overview, Goals, User Stories, Requirements, Constraints, and Success Metrics.",
];

const CREATE_MODE_INSTRUCTIONS = [
  "You are starting a new PRD from scratch.",
  "Begin by understanding the product vision and target audience.",
  "Guide the user through each section methodically.",
  "Suggest reasonable defaults but always confirm with the user.",
];

const REFINE_MODE_INSTRUCTIONS = [
  "You are refining an existing PRD document.",
  "Analyze the provided PRD for completeness, clarity, and consistency.",
  "Suggest improvements and identify gaps.",
  "Preserve the original intent while enhancing quality.",
];

const CONSTRAINTS = [
  "Keep language precise and unambiguous.",
  "Use measurable acceptance criteria where possible.",
  "Flag any conflicting requirements.",
  "Maintain traceability between goals and requirements.",
  "Output PRD content in well-structured Markdown.",
];

export interface BuildSystemPromptOptions {
  mode: "create" | "refine";
  prdContent?: string;
  projectDescription?: string;
}

/**
 * Build the full system prompt for a PRD agent session.
 */
export function buildSystemPrompt(opts: BuildSystemPromptOptions): string {
  const sections: string[] = [];

  // Base capabilities
  sections.push("# Capabilities\n");
  sections.push(BASE_CAPABILITIES.join("\n"));

  // Mode-specific instructions
  sections.push("\n\n# Instructions\n");
  if (opts.mode === "create") {
    sections.push(CREATE_MODE_INSTRUCTIONS.join("\n"));
  } else {
    sections.push(REFINE_MODE_INSTRUCTIONS.join("\n"));
  }

  // Constraints
  sections.push("\n\n# Constraints\n");
  sections.push(CONSTRAINTS.join("\n"));

  // Existing PRD content (refine mode)
  if (opts.mode === "refine" && opts.prdContent) {
    sections.push("\n\n# Existing PRD\n");
    sections.push("Below is the current PRD to refine:\n");
    sections.push("```markdown");
    sections.push(opts.prdContent);
    sections.push("```");
  }

  // Project description context
  if (opts.projectDescription) {
    sections.push("\n\n# Project Context\n");
    sections.push(opts.projectDescription);
  }

  return sections.join("\n");
}
