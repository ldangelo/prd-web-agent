export interface CommentData {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  resolved: boolean;
  resolvedBy?: string;
  createdAt: string;
  replies: CommentData[];
}
