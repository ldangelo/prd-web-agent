import { createResourceLoader } from "../resource-loader";

describe("createResourceLoader", () => {
  it("creates a resource loader for 'create' mode", () => {
    const loader = createResourceLoader({ mode: "create" });

    expect(loader.getSkills().skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "prd-authoring" }),
      ]),
    );
    // Create mode should not include the analysis skill
    expect(
      loader.getSkills().skills.find((s) => s.name === "prd-analysis"),
    ).toBeUndefined();
  });

  it("creates a resource loader for 'refine' mode with extra skills", () => {
    const loader = createResourceLoader({
      mode: "refine",
      prdContent: "# My PRD",
    });

    const skillNames = loader.getSkills().skills.map((s) => s.name);
    expect(skillNames).toContain("prd-authoring");
    expect(skillNames).toContain("prd-analysis");
  });

  it("includes capabilities and constraints in the system prompt", () => {
    const loader = createResourceLoader({ mode: "create" });
    const prompt = loader.getSystemPrompt();

    expect(prompt).toContain("Capabilities");
    expect(prompt).toContain("Constraints");
    expect(prompt).toContain("PRD");
  });

  it("includes existing PRD content in refine mode system prompt", () => {
    const prdContent = "# Existing PRD\n\nSome requirements here.";
    const loader = createResourceLoader({ mode: "refine", prdContent });
    const prompt = loader.getSystemPrompt();

    expect(prompt).toContain("Existing PRD");
    expect(prompt).toContain(prdContent);
    expect(prompt).toContain("refining an existing PRD");
  });

  it("does not include existing PRD section in create mode", () => {
    const loader = createResourceLoader({ mode: "create" });
    const prompt = loader.getSystemPrompt();

    expect(prompt).not.toContain("Existing PRD");
    expect(prompt).toContain("starting a new PRD from scratch");
  });

  it("returns empty collections for extensions, prompts, themes", () => {
    const loader = createResourceLoader({ mode: "create" });

    expect(loader.getExtensions()).toEqual({
      extensions: [],
      errors: [],
      runtime: null,
    });
    expect(loader.getPrompts()).toEqual({ prompts: [], diagnostics: [] });
    expect(loader.getThemes()).toEqual({ themes: [], diagnostics: [] });
    expect(loader.getAgentsFiles()).toEqual({ agentsFiles: [] });
    expect(loader.getAppendSystemPrompt()).toEqual([]);
    expect(loader.getPathMetadata()).toBeInstanceOf(Map);
  });

  it("reload resolves without error", async () => {
    const loader = createResourceLoader({ mode: "create" });
    await expect(loader.reload()).resolves.toBeUndefined();
  });
});
