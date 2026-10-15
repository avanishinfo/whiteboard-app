import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

interface WhiteboardDB extends DBSchema {
  boards: {
    key: string;
    value: {
      id: string;
      name: string;
      canvasJSON: string;
      updatedAt: number;
      createdAt: number;
    };
  };
}

const DB_NAME = 'whiteboard-db';
const DB_VERSION = 1;
const BOARD_ID = 'main-board';

let db: IDBPDatabase<WhiteboardDB> | null = null;

async function getDB(): Promise<IDBPDatabase<WhiteboardDB>> {
  if (db) return db;
  db = await openDB<WhiteboardDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('boards', { keyPath: 'id' });
    },
  });
  return db;
}

export async function saveBoard(canvasJSON: string, name: string = 'Untitled Board'): Promise<void> {
  const database = await getDB();
  const existing = await database.get('boards', BOARD_ID);
  await database.put('boards', {
    id: BOARD_ID,
    name,
    canvasJSON,
    updatedAt: Date.now(),
    createdAt: existing?.createdAt ?? Date.now(),
  });
}

export async function loadBoard(): Promise<{ canvasJSON: string; name: string } | null> {
  try {
    const database = await getDB();
    const board = await database.get('boards', BOARD_ID);
    if (!board) return null;
    return { canvasJSON: board.canvasJSON, name: board.name };
  } catch {
    return null;
  }
}

export async function clearBoard(): Promise<void> {
  const database = await getDB();
  await database.delete('boards', BOARD_ID);
}
