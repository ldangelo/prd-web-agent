"use client";

/**
 * MarkdownRenderer - Renders markdown content as styled HTML.
 *
 * Uses react-markdown with remark-gfm for GitHub Flavored Markdown support
 * including tables, strikethrough, task lists, and autolinks.
 * Headings receive id attributes for anchor linking from the TableOfContents.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

export interface MarkdownRendererProps {
  content: string;
}

/**
 * Convert heading text to a URL-friendly slug.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Extract plain text from React children (handles nested elements).
 */
function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractText((children as React.ReactElement).props.children);
  }
  return "";
}

/**
 * Custom heading components that add id attributes for anchor navigation.
 */
function createHeadingComponent(level: number) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return function HeadingWithId({
    children,
  }: {
    children?: React.ReactNode;
  }) {
    const text = extractText(children);
    const id = slugify(text);
    return <Tag id={id}>{children}</Tag>;
  };
}

const components: Partial<Components> = {
  h1: createHeadingComponent(1) as Components["h1"],
  h2: createHeadingComponent(2) as Components["h2"],
  h3: createHeadingComponent(3) as Components["h3"],
  h4: createHeadingComponent(4) as Components["h4"],
  h5: createHeadingComponent(5) as Components["h5"],
  h6: createHeadingComponent(6) as Components["h6"],
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-slate max-w-none dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
