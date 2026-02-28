"use client";

/**
 * TableOfContents - Extracts headings from markdown and renders sidebar navigation.
 *
 * Parses markdown content for headings (h1-h6), generates anchor links,
 * and provides smooth-scroll navigation to each section.
 */

import { useMemo } from "react";

export interface TableOfContentsProps {
  content: string;
}

interface HeadingEntry {
  level: number;
  text: string;
  slug: string;
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
 * Extract headings from markdown content using regex.
 */
function extractHeadings(content: string): HeadingEntry[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: HeadingEntry[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    headings.push({
      level,
      text,
      slug: slugify(text),
    });
  }

  return headings;
}

const INDENT_MAP: Record<number, string> = {
  1: "pl-0",
  2: "pl-4",
  3: "pl-8",
  4: "pl-12",
  5: "pl-16",
  6: "pl-20",
};

export function TableOfContents({ content }: TableOfContentsProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);

  return (
    <nav aria-label="Table of contents" className="sticky top-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Table of Contents
      </h2>
      <ul className="space-y-1">
        {headings.map((heading, index) => (
          <li
            key={`${heading.slug}-${index}`}
            className={INDENT_MAP[heading.level] ?? "pl-0"}
          >
            <a
              href={`#${heading.slug}`}
              className="block text-sm text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(heading.slug);
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
