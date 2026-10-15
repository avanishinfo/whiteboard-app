import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';

const PORT = Number(process.env.PORT ?? 8080);

// ── Colour palette assigned round-robin per room ───────────────────────────────
const CURSOR_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// ── Message types ─────────────────────────────────────────────────────────────
// Client → Server
interface CanvasSyncMsg  { type: 'canvas:sync';  canvasJSON: string }
interface CursorMoveMsg  { type: 'cursor:move';  x: number; y: number }
type ClientMessage = CanvasSyncMsg | CursorMoveMsg;

// Server → Client
interface RoomJoinedMsg  { type: 'room:joined'; userId: string; color: string; canvasJSON: string | null; users: UserInfo[] }
interface CanvasBcastMsg { type: 'canvas:sync'; canvasJSON: string; fromUserId: string }
interface CursorBcastMsg { type: 'cursor:move'; userId: string; color: string; x: number; y: number }
interface UserJoinMsg    { type: 'user:join';   userId: string; color: string }
interface UserLeaveMsg   { type: 'user:leave';  userId: string }
type ServerMessage = RoomJoinedMsg | CanvasBcastMsg | CursorBcastMsg | UserJoinMsg | UserLeaveMsg;

interface UserInfo { id: string; color: string }

// ── Room ──────────────────────────────────────────────────────────────────────
class Room {
  readonly id: string;
  private users = new Map<string, { info: UserInfo; ws: WebSocket }>();
  private colorIndex = 0;
  canvasJSON: string | null = null; // latest canvas state — sent to new joiners

  constructor(id: string) {
    this.id = id;
  }

  addUser(ws: WebSocket): UserInfo {
    const info: UserInfo = {
      id: randomUUID(),
      color: CURSOR_COLORS[this.colorIndex++ % CURSOR_COLORS.length],
    };
    this.users.set(info.id, { info, ws });
    return info;
  }

  removeUser(userId: string) {
    this.users.delete(userId);
  }

  get size() { return this.users.size; }

  getUserList(): UserInfo[] {
    return Array.from(this.users.values()).map(u => u.info);
  }

  send(userId: string, msg: ServerMessage) {
    const entry = this.users.get(userId);
    if (entry?.ws.readyState === WebSocket.OPEN) {
      entry.ws.send(JSON.stringify(msg));
    }
  }

  broadcast(msg: ServerMessage, excludeUserId?: string) {
    const data = JSON.stringify(msg);
    this.users.forEach(({ info, ws }) => {
      if (info.id !== excludeUserId && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }
}

// ── Room registry ─────────────────────────────────────────────────────────────
const rooms = new Map<string, Room>();

function getOrCreateRoom(id: string): Room {
  if (!rooms.has(id)) rooms.set(id, new Room(id));
  return rooms.get(id)!;
}

function getRoomId(req: IncomingMessage): string {
  const match = (req.url ?? '').match(/^\/room\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : 'default';
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/health') {
    const payload = {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      rooms: rooms.size,
      totalUsers: Array.from(rooms.values()).reduce((n, r) => n + r.size, 0),
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const roomId = getRoomId(req);
  const room = getOrCreateRoom(roomId);
  const me = room.addUser(ws);

  log(`[join]  room="${roomId}"  user=${me.id.slice(0, 8)}  color=${me.color}  size=${room.size}`);

  // 1. Tell this user who they are, and the current canvas + everyone else
  room.send(me.id, {
    type: 'room:joined',
    userId: me.id,
    color: me.color,
    canvasJSON: room.canvasJSON,
    users: room.getUserList().filter(u => u.id !== me.id),
  });

  // 2. Tell everyone else a new user joined
  room.broadcast({ type: 'user:join', userId: me.id, color: me.color }, me.id);

  // 3. Handle incoming messages
  ws.on('message', (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type === 'canvas:sync') {
      // Store latest state so future joiners get it
      room.canvasJSON = msg.canvasJSON;
      // Broadcast to all other users in the room
      room.broadcast({ type: 'canvas:sync', canvasJSON: msg.canvasJSON, fromUserId: me.id }, me.id);
    }

    if (msg.type === 'cursor:move') {
      room.broadcast({ type: 'cursor:move', userId: me.id, color: me.color, x: msg.x, y: msg.y }, me.id);
    }
  });

  ws.on('close', () => {
    room.removeUser(me.id);
    if (room.size === 0) rooms.delete(roomId);
    room.broadcast({ type: 'user:leave', userId: me.id });
    log(`[leave] room="${roomId}"  user=${me.id.slice(0, 8)}  size=${room.size}`);
  });

  ws.on('error', (err) => {
    console.error(`WS error user=${me.id.slice(0, 8)}:`, err.message);
    room.removeUser(me.id);
    if (room.size === 0) rooms.delete(roomId);
  });
});

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

httpServer.listen(PORT, '0.0.0.0', () => {
  log(`WebSocket server listening on port ${PORT}`);
});
