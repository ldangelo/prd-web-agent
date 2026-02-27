/**
 * WebSocket service barrel export.
 */
export { webSocketService, WebSocketService } from "./socket-server";
export type { SocketServerConfig } from "./socket-server";

export { registerAgentNamespace } from "./namespaces/agent-namespace";
export type {
  AgentClientEvents,
  AgentServerEvents,
} from "./namespaces/agent-namespace";

export { registerNotificationNamespace } from "./namespaces/notification-namespace";
export type { NotificationServerEvents } from "./namespaces/notification-namespace";
