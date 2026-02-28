"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageComposerProps {
  onSend: (text: string, images?: File[]) => void;
  disabled: boolean;
}

export function MessageComposer({ onSend, disabled }: MessageComposerProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    onSend(trimmed, files.length > 0 ? files : undefined);
    setText("");
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-border bg-card p-4"
    >
      <div className="flex flex-1 flex-col gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          disabled={disabled}
          rows={1}
          aria-label="Message"
          className="min-h-0 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          <span>Attach image</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Attach image"
          />
        </label>
        {files.length > 0 && (
          <div className="flex gap-1 text-xs text-muted-foreground">
            {files.map((f, i) => (
              <span key={i} className="rounded bg-muted px-2 py-0.5">
                {f.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <Button type="submit" disabled={disabled}>
        Send
      </Button>
    </form>
  );
}
