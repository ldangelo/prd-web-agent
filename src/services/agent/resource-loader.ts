/**
 * Custom ResourceLoader for PRD agent sessions.
 *
 * Implements the ResourceLoaderInterface expected by the pi SDK so that
 * the agent receives the correct system prompt, skills, and extensions
 * depending on whether it is creating or refining a PRD.
 */

import type { ResourceLoaderInterface, Skill } from "@/types/pi-sdk";
import { buildSystemPrompt } from "./system-prompt";

export interface CreateResourceLoaderOptions {
  mode: "create" | "refine";
  prdContent?: string;
  projectDescription?: string;
}

/**
 * Factory that produces a ResourceLoaderInterface tailored to the given mode.
 */
export function createResourceLoader(
  opts: CreateResourceLoaderOptions,
): ResourceLoaderInterface {
  const systemPrompt = buildSystemPrompt({
    mode: opts.mode,
    prdContent: opts.prdContent,
    projectDescription: opts.projectDescription,
  });

  const skills: Skill[] = [
    {
      name: "prd-authoring",
      description: "Skill for authoring and structuring PRD documents",
      filePath: "skills/prd-authoring",
      baseDir: ".",
      source: "built-in",
    },
  ];

  if (opts.mode === "refine") {
    skills.push({
      name: "prd-analysis",
      description: "Skill for analysing and improving existing PRDs",
      filePath: "skills/prd-analysis",
      baseDir: ".",
      source: "built-in",
    });
  }

  return {
    getSkills() {
      return { skills, diagnostics: [] };
    },

    getSystemPrompt() {
      return systemPrompt;
    },

    getExtensions() {
      return { extensions: [], errors: [], runtime: null };
    },

    getPrompts() {
      return { prompts: [], diagnostics: [] };
    },

    getThemes() {
      return { themes: [], diagnostics: [] };
    },

    getAgentsFiles() {
      return { agentsFiles: [] };
    },

    getAppendSystemPrompt() {
      return [];
    },

    getPathMetadata() {
      return new Map();
    },

    extendResources() {
      // no-op for now
    },

    async reload() {
      // no-op for now -- skills are statically defined
    },
  };
}
