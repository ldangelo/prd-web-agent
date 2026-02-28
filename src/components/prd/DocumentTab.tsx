"use client";

/**
 * DocumentTab - Two-column layout composing TableOfContents and MarkdownRenderer.
 *
 * Displays the table of contents in a left sidebar and the rendered markdown
 * document in the main content area.
 */

import { MarkdownRenderer } from "./MarkdownRenderer";
import { TableOfContents } from "./TableOfContents";

export interface DocumentTabProps {
  content: string;
}

export function DocumentTab({ content }: DocumentTabProps) {
  if (!content) {
    return (
      <p className="text-muted-foreground">No document content available.</p>
    );
  }

  return (
    <div className="flex gap-8">
      {/* Sidebar: Table of Contents */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <TableOfContents content={content} />
      </aside>

      {/* Main content: Rendered Markdown */}
      <div className="min-w-0 flex-1">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}
