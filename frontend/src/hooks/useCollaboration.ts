// useCollaboration — manages the WebSocket lifecycle and collaborative state.
// Subscribes to canvas events independently of useWhiteboardCanvas.
import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { createWhiteboardSocket, WhiteboardSocket } from '../services/websocket';
import type { ConnectionStatus, UserInfo } from '../services/websocket';

export interface RemoteUser extends UserInfo {
  cursorX: number | null;
  cursorY: number | null;
}

export interface CollabState {
  connectionStatus: ConnectionStatus;
  roomId: string;
  myUserId: string | null;
  myColor: string | null;
  remoteUsers: Map<string, RemoteUser>;
}

// Throttle helper — calls fn at most once per `ms` milliseconds
function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let last = 0;
  return ((...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  }) as T;
}

export function useCollaboration(
  fabricRef: React.RefObject<fabric.Canvas | null>,
  isReady: boolean,
) {
  const socketRef = useRef<WhiteboardSocket | null>(null);
  const isRemoteUpdateRef = useRef(false);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disabled');
  const [myUserId,  setMyUserId]  = useState<string | null>(null);
  const [myColor,   setMyColor]   = useState<string | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<Map<string, RemoteUser>>(new Map());

  const roomId = new URLSearchParams(window.location.search).get('room') ?? 'default';

  // ── Create / tear down the socket ────────────────────────────────────────────
  useEffect(() => {
    const socket = createWhiteboardSocket(roomId);
    if (!socket) {
      setConnectionStatus('disabled');
      return;
    }
    socketRef.current = socket;

    const offStatus = socket.onStatus(setConnectionStatus);

    const offMessage = socket.onMessage((msg) => {
      const canvas = fabricRef.current;

      if (msg.type === 'room:joined') {
        setMyUserId(msg.userId);
        setMyColor(msg.color);

        // Seed remote user list (everyone already in the room)
        setRemoteUsers(new Map(msg.users.map(u => [u.id, { ...u, cursorX: null, cursorY: null }])));

        // Load existing canvas state so the late-joiner catches up
        if (msg.canvasJSON && canvas) {
          isRemoteUpdateRef.current = true;
          canvas.loadFromJSON(msg.canvasJSON).then(() => {
            canvas.renderAll();
            isRemoteUpdateRef.current = false;
          });
        }
      }

      if (msg.type === 'user:join') {
        setRemoteUsers(prev => {
          const next = new Map(prev);
          next.set(msg.userId, { id: msg.userId, color: msg.color, cursorX: null, cursorY: null });
          return next;
        });
      }

      if (msg.type === 'user:leave') {
        setRemoteUsers(prev => {
          const next = new Map(prev);
          next.delete(msg.userId);
          return next;
        });
      }

      if (msg.type === 'canvas:sync' && canvas) {
        isRemoteUpdateRef.current = true;
        canvas.loadFromJSON(msg.canvasJSON).then(() => {
          canvas.renderAll();
          isRemoteUpdateRef.current = false;
        });
      }

      if (msg.type === 'cursor:move') {
        setRemoteUsers(prev => {
          const user = prev.get(msg.userId);
          if (!user) return prev;
          const next = new Map(prev);
          next.set(msg.userId, { ...user, cursorX: msg.x, cursorY: msg.y });
          return next;
        });
      }
    });

    return () => {
      offStatus();
      offMessage();
      socket.destroy();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── Subscribe to canvas events once the canvas is ready ──────────────────────
  useEffect(() => {
    if (!isReady) return;
    const canvas = fabricRef.current;
    if (!canvas) return;

    const broadcastCanvas = () => {
      if (isRemoteUpdateRef.current) return;
      socketRef.current?.send({ type: 'canvas:sync', canvasJSON: JSON.stringify(canvas.toJSON()) });
    };

    // Throttled cursor broadcast (50ms ≈ 20 fps — enough for smooth feel)
    const broadcastCursor = throttle((e: fabric.TPointerEventInfo) => {
      if (!socketRef.current) return;
      const point = canvas.getScenePoint(e.e as MouseEvent);
      socketRef.current.send({ type: 'cursor:move', x: point.x, y: point.y });
    }, 50) as (e: fabric.TPointerEventInfo) => void;

    canvas.on('path:created',    broadcastCanvas);
    canvas.on('object:modified', broadcastCanvas);
    canvas.on('object:added',    broadcastCanvas);
    canvas.on('object:removed',  broadcastCanvas);
    canvas.on('mouse:move',      broadcastCursor);

    return () => {
      canvas.off('path:created',    broadcastCanvas);
      canvas.off('object:modified', broadcastCanvas);
      canvas.off('object:added',    broadcastCanvas);
      canvas.off('object:removed',  broadcastCanvas);
      canvas.off('mouse:move',      broadcastCursor);
    };
  }, [isReady, fabricRef]);

  const sendCanvasSync = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || isRemoteUpdateRef.current) return;
    socketRef.current?.send({ type: 'canvas:sync', canvasJSON: JSON.stringify(canvas.toJSON()) });
  }, [fabricRef]);

  return {
    connectionStatus,
    roomId,
    myUserId,
    myColor,
    remoteUsers,
    sendCanvasSync,
  } satisfies CollabState & { sendCanvasSync: () => void };
}
