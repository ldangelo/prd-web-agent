"use client";

import React, { useState } from "react";
import type { CommentData } from "@/types/comments";
import { CommentItem } from "./CommentItem";
import { CommentComposer } from "./CommentComposer";

export interface CommentThreadProps {
  comment: CommentData;
  onReply: (parentId: string, body: string) => void;
  onResolve: (commentId: string) => void;
}

export function CommentThread({ comment, onReply, onResolve }: CommentThreadProps) {
  const [showReplyComposer, setShowReplyComposer] = useState(false);

  const handleReply = (body: string) => {
    onReply(comment.id, body);
    setShowReplyComposer(false);
  };

  return (
    <div className="border-l-2 border-border pl-4">
      <CommentItem comment={comment} onResolve={onResolve} showResolve />

      {comment.replies.length > 0 && (
        <div className="ml-4 space-y-1">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onResolve={onResolve}
              showResolve={false}
            />
          ))}
        </div>
      )}

      <div className="mt-1">
        {!showReplyComposer ? (
          <button
            type="button"
            onClick={() => setShowReplyComposer(true)}
            className="text-xs font-medium text-primary hover:text-primary/80"
          >
            Reply
          </button>
        ) : (
          <div className="mt-2">
            <CommentComposer
              onSubmit={handleReply}
              placeholder="Write a reply..."
            />
            <button
              type="button"
              onClick={() => setShowReplyComposer(false)}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
