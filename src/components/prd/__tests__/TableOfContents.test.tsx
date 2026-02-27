/**
 * TableOfContents component tests.
 *
 * Verifies heading extraction from markdown content and link rendering.
 */
import { render, screen } from "@testing-library/react";
import { TableOfContents } from "../TableOfContents";

describe("TableOfContents", () => {
  it("extracts headings from content", () => {
    const content =
      "# Introduction\n\n## Background\n\n## Requirements\n\n### Functional";
    render(<TableOfContents content={content} />);

    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Background")).toBeInTheDocument();
    expect(screen.getByText("Requirements")).toBeInTheDocument();
    expect(screen.getByText("Functional")).toBeInTheDocument();
  });

  it("renders heading links with correct href", () => {
    const content = "## My Section\n\n## Another Section";
    render(<TableOfContents content={content} />);

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "#my-section");
    expect(links[1]).toHaveAttribute("href", "#another-section");
  });

  it("renders nothing when content has no headings", () => {
    const content = "Just a paragraph with no headings.";
    const { container } = render(<TableOfContents content={content} />);

    const nav = container.querySelector("nav");
    expect(nav).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("applies indentation based on heading level", () => {
    const content = "# Top Level\n\n## Sub Level\n\n### Sub Sub Level";
    const { container } = render(<TableOfContents content={content} />);

    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(3);
    // h1 = no indent, h2 = indent, h3 = more indent
    expect(items[0].className).toContain("pl-0");
    expect(items[1].className).toContain("pl-4");
    expect(items[2].className).toContain("pl-8");
  });
});
