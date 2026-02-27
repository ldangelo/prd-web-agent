export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  images?: string[]; // data URLs for user-attached images
}
