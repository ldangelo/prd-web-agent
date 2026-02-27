/**
 * MarkdownRenderer component tests.
 *
 * Verifies that the MarkdownRenderer correctly renders various markdown
 * elements including headings, tables, and code blocks.
 *
 * react-markdown is an ESM-only package, so we mock it to avoid Jest
 * transform issues. The mock simulates basic markdown parsing behavior.
 */

// Mock react-markdown as it is ESM-only
jest.mock("react-markdown", () => {
  const React = require("react");

  /**
   * Simple mock that parses markdown into basic HTML elements.
   * Supports headings, tables, code blocks, links, and lists.
   */
  function MockReactMarkdown({
    children,
    components,
  }: {
    children: string;
    components?: Record<string, React.ComponentType<any>>;
    remarkPlugins?: unknown[];
  }) {
    const lines = children.split("\n");
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];

    function flushTable() {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const bodyRows = tableRows.slice(1);
        elements.push(
          React.createElement(
            "table",
            { key: `table-${elements.length}` },
            React.createElement(
              "thead",
              null,
              React.createElement(
                "tr",
                null,
                headerRow.map((cell: string, i: number) =>
                  React.createElement("th", { key: i }, cell.trim()),
                ),
              ),
            ),
            React.createElement(
              "tbody",
              null,
              bodyRows.map((row: string[], ri: number) =>
                React.createElement(
                  "tr",
                  { key: ri },
                  row.map((cell: string, ci: number) =>
                    React.createElement("td", { key: ci }, cell.trim()),
                  ),
                ),
              ),
            ),
          ),
        );
        tableRows = [];
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            React.createElement(
              "pre",
              { key: `code-${i}` },
              React.createElement("code", null, codeContent.join("\n")),
            ),
          );
          codeContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // Tables
      if (line.includes("|") && line.trim().startsWith("|")) {
        // Skip separator lines
        if (/^\|[\s-|]+\|$/.test(line.trim())) continue;

        const cells = line
          .split("|")
          .filter((c: string) => c.trim() !== "");
        if (cells.length > 0) {
          if (!inTable) inTable = true;
          tableRows.push(cells);
        }
        continue;
      } else if (inTable) {
        flushTable();
        inTable = false;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        const HeadingComponent =
          components?.[`h${level}` as keyof typeof components];
        if (HeadingComponent) {
          elements.push(
            React.createElement(
              HeadingComponent,
              { key: `h-${i}` },
              text,
            ),
          );
        } else {
          elements.push(
            React.createElement(`h${level}`, { key: `h-${i}` }, text),
          );
        }
        continue;
      }

      // Links
      const linkMatch = line.match(/\[(.+?)\]\((.+?)\)/);
      if (linkMatch) {
        elements.push(
          React.createElement(
            "a",
            { key: `a-${i}`, href: linkMatch[2] },
            linkMatch[1],
          ),
        );
        continue;
      }

      // Unordered list items
      if (line.match(/^[-*]\s+(.+)/)) {
        const text = line.replace(/^[-*]\s+/, "");
        elements.push(
          React.createElement("li", { key: `li-${i}` }, text),
        );
        continue;
      }

      // Paragraphs (non-empty lines)
      if (line.trim()) {
        elements.push(
          React.createElement("p", { key: `p-${i}` }, line),
        );
      }
    }

    if (inTable) flushTable();

    return React.createElement("div", null, ...elements);
  }

  return {
    __esModule: true,
    default: MockReactMarkdown,
  };
});

jest.mock("remark-gfm", () => ({
  __esModule: true,
  default: () => {},
}));

import { render, screen } from "@testing-library/react";
import { MarkdownRenderer } from "../MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders markdown headings", () => {
    const content = "# Heading One\n\n## Heading Two\n\n### Heading Three";
    render(<MarkdownRenderer content={content} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Heading One" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Heading Two" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Heading Three" }),
    ).toBeInTheDocument();
  });

  it("renders markdown tables", () => {
    const content = `| Name  | Age |
|-------|-----|
| Alice | 30  |
| Bob   | 25  |`;
    render(<MarkdownRenderer content={content} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders code blocks", () => {
    const content = "```typescript\nconst x: number = 42;\n```";
    render(<MarkdownRenderer content={content} />);

    expect(screen.getByText("const x: number = 42;")).toBeInTheDocument();
  });

  it("renders links", () => {
    const content = "[Example](https://example.com)";
    render(<MarkdownRenderer content={content} />);

    const link = screen.getByRole("link", { name: "Example" });
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("renders unordered lists", () => {
    const content = "- Item one\n- Item two\n- Item three";
    render(<MarkdownRenderer content={content} />);

    expect(screen.getByText("Item one")).toBeInTheDocument();
    expect(screen.getByText("Item two")).toBeInTheDocument();
  });

  it("adds id attributes to headings for anchor linking", () => {
    const content = "## My Section Title";
    const { container } = render(<MarkdownRenderer content={content} />);

    const heading = container.querySelector("h2");
    expect(heading).toHaveAttribute("id", "my-section-title");
  });
});
