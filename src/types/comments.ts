export interface CommentData {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  parentId?: string | null;
  resolved: boolean;
  resolvedBy?: string;
  createdAt: string;
  replies: CommentData[];
}
