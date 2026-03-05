/**
 * Build the agent prompt for initial PRD creation.
 * Shared between the SSE generate endpoint and the background generator.
 *
 * The agent runs as a text-only chat session (OpenClaw) and cannot execute
 * bash or make HTTP requests. Repo context is injected directly here by
 * reading key files server-side. The generate route saves the PRD content
 * captured from the SSE stream — the agent does NOT need to call any save API.
 */
import * as fs from "fs";
import * as path from "path";

/** Files to read from the repo root and inject as context (in order). */
const REPO_CONTEXT_FILES = [
  "README.md",
  "package.json",
  "go.mod",
  "requirements.txt",
  "pyproject.toml",
];

/** Max characters to inject per file to keep prompt size reasonable. */
const MAX_FILE_CHARS = 4000;

/**
 * Read a file and return its content truncated to MAX_FILE_CHARS.
 * Returns null if the file doesn't exist or can't be read.
 */
function readFileSafe(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.length > MAX_FILE_CHARS
      ? content.slice(0, MAX_FILE_CHARS) + "\n…[truncated]"
      : content;
  } catch {
    return null;
  }
}

/**
 * Read key files from the cloned repo and return them as a formatted context block.
 */
function buildRepoContext(repoPath: string): string | null {
  const sections: string[] = [];

  for (const filename of REPO_CONTEXT_FILES) {
    const content = readFileSafe(path.join(repoPath, filename));
    if (content) {
      sections.push(`### ${filename}\n\`\`\`\n${content}\n\`\`\``);
    }
  }

  if (sections.length === 0) return null;

  return [
    "## Project Repository Context",
    "",
    "The following files were read from the project repository to help ground the PRD in the actual codebase:",
    "",
    ...sections,
  ].join("\n");
}

export function buildCreatePrompt(
  description: string,
  context?: { userId?: string; projectId?: string; repoPath?: string },
): string {
  const lines = [
    `Create a comprehensive PRD for the following product:`,
    ``,
    description,
    ``,
    `Output the complete PRD as well-structured Markdown. Include sections for:`,
    `Summary, Problem Statement, User Analysis, Goals/Non-Goals,`,
    `Functional Requirements (in Gherkin format), Non-Functional Requirements, and Success Metrics.`,
    ``,
    `IMPORTANT: Output ONLY the PRD content in Markdown. Do not include commentary, shell commands,`,
    `or API calls — the system will save the PRD automatically from your output.`,
  ];

  // Inject repo context if a cloned repo path was provided
  const repoPath =
    context?.repoPath ??
    (context?.userId && context?.projectId
      ? `${process.env.EFS_REPOS_DIR ?? "/efs/repos"}/${context.userId}/${context.projectId}`
      : null);

  if (repoPath) {
    const repoContext = buildRepoContext(repoPath);
    if (repoContext) {
      lines.push(``);
      lines.push(repoContext);
      lines.push(``);
      lines.push(
        `Use the repository context above to ensure the PRD is consistent with the existing codebase, tech stack, and conventions.`,
      );
    }
  }

  return lines.join("\n");
}
