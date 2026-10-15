// Typed WebSocket client for real-time whiteboard collaboration.
// Disabled gracefully when VITE_WS_URL is not configured.

// ── Message types (mirrors backend/src/server.ts) ─────────────────────────────

export interface UserInfo { id: string; color: string }

// Server → Client
export type ServerMessage =
  | { type: 'room:joined'; userId: string; color: string; canvasJSON: string | null; users: UserInfo[] }
  | { type: 'canvas:sync'; canvasJSON: string; fromUserId: string }
  | { type: 'cursor:move'; userId: string; color: string; x: number; y: number }
  | { type: 'user:join';   userId: string; color: string }
  | { type: 'user:leave';  userId: string };

// Client → Server
export type ClientMessage =
  | { type: 'canvas:sync'; canvasJSON: string }
  | { type: 'cursor:move'; x: number; y: number };

export type ConnectionStatus = 'disabled' | 'connecting' | 'connected' | 'disconnected';

// ── WhiteboardSocket ──────────────────────────────────────────────────────────

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS  = 30_000;

type MessageHandler = (msg: ServerMessage) => void;
type StatusHandler  = (status: ConnectionStatus) => void;

export class WhiteboardSocket {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers:  Set<StatusHandler>  = new Set();
  private reconnectDelay = RECONNECT_BASE_MS;
  private destroyed = false;
  private readonly url: string;

  constructor(baseUrl: string, roomId: string) {
    const base = baseUrl.replace(/\/$/, '').replace(/^http/, 'ws');
    this.url = `${base}/room/${encodeURIComponent(roomId)}`;
    this.connect();
  }

  private connect() {
    if (this.destroyed) return;
    this.emitStatus('connecting');

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = RECONNECT_BASE_MS;
      this.emitStatus('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        this.messageHandlers.forEach(h => h(msg));
      } catch { /* ignore malformed */ }
    };

    this.ws.onclose = () => {
      if (this.destroyed) return;
      this.emitStatus('disconnected');
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
        this.connect();
      }, this.reconnectDelay);
    };

    this.ws.onerror = () => { /* onclose always follows */ };
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  destroy() {
    this.destroyed = true;
    this.ws?.close();
    this.ws = null;
    this.messageHandlers.clear();
    this.statusHandlers.clear();
  }

  private emitStatus(status: ConnectionStatus) {
    this.statusHandlers.forEach(h => h(status));
  }
}

export function createWhiteboardSocket(roomId: string): WhiteboardSocket | null {
  const baseUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (!baseUrl) return null;
  return new WhiteboardSocket(baseUrl, roomId);
}
