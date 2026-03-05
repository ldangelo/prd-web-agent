"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { CommentData } from "@/types/comments";
import { CommentThread } from "./CommentThread";
import { CommentComposer } from "./CommentComposer";

export interface CommentsListProps {
  prdId: string;
}

export function CommentsList({ prdId }: CommentsListProps) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prds/${prdId}/comments`);
      if (res.ok) {
        const json = await res.json();
        setComments(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [prdId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleNewComment = async (body: string) => {
    await fetch(`/api/prds/${prdId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    fetchComments();
  };

  const handleReply = async (parentId: string, body: string) => {
    await fetch(`/api/prds/${prdId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, parentId }),
    });
    fetchComments();
  };

  const handleResolve = async (commentId: string) => {
    await fetch(`/api/prds/${prdId}/comments/${commentId}/resolve`, {
      method: "PATCH",
    });
    fetchComments();
  };

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Loading comments...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CommentComposer
        onSubmit={handleNewComment}
        placeholder="Add a comment..."
      />

      {comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No comments yet
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}
