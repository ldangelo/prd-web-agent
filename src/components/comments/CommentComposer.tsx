"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface CommentComposerProps {
  onSubmit: (body: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CommentComposer({
  onSubmit,
  placeholder = "Add a comment...",
  disabled = false,
}: CommentComposerProps) {
  const [body, setBody] = useState("");

  const handleSubmit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setBody("");
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="comment-composer" className="sr-only">
        Comment
      </Label>
      <Textarea
        id="comment-composer"
        placeholder={placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={disabled}
        rows={3}
        aria-label="Comment"
      />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={disabled || body.trim().length === 0}
          aria-label="Submit comment"
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
