// ─── Tool Types ────────────────────────────────────────────────────────────────

export type ToolType =
  | 'select'
  | 'pan'
  | 'pencil'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'text'
  | 'sticky-note'
  | 'image';

export type ShapeType =
  | 'rectangle'
  | 'rounded-rectangle'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'line'
  | 'arrow';

// ─── Board Object Types ────────────────────────────────────────────────────────

export interface BoardObject {
  id: string;
  type: string;
  fabricData: Record<string, unknown>;
  zIndex: number;
  locked?: boolean;
  groupId?: string;
}

// ─── Tool Settings ─────────────────────────────────────────────────────────────

export interface DrawingSettings {
  color: string;
  strokeWidth: number;
  opacity: number;
  fillColor: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  snapToGrid: boolean;
}

export interface StickyNoteColor {
  bg: string;
  border: string;
  label: string;
}

// ─── Board State ───────────────────────────────────────────────────────────────

export interface BoardState {
  id: string;
  name: string;
  objects: BoardObject[];
  viewport: ViewportState;
  settings: DrawingSettings;
  createdAt: number;
  updatedAt: number;
}

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  json: string;
  timestamp: number;
}

// ─── Export Types ─────────────────────────────────────────────────────────────

export interface ExportJSON {
  version: string;
  board: BoardState;
  fabricCanvas: Record<string, unknown>;
  exportedAt: number;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export interface UIState {
  activeTool: ToolType;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  selectedObjectIds: string[];
  isPanning: boolean;
  isDrawing: boolean;
  zoom: number;
  panX: number;
  panY: number;
  rightPanelOpen: boolean;
  leftPanelOpen: boolean;
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

export interface ClipboardData {
  objects: unknown[];
  offsetX: number;
  offsetY: number;
}

// ─── App Store ────────────────────────────────────────────────────────────────

export interface AppStore {
  // UI
  ui: UIState;
  setTool: (tool: ToolType) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;
  setRightPanelOpen: (open: boolean) => void;

  // Settings
  settings: DrawingSettings;
  updateSettings: (partial: Partial<DrawingSettings>) => void;

  // Board meta
  boardName: string;
  setBoardName: (name: string) => void;

  // Clipboard
  clipboard: ClipboardData | null;
  setClipboard: (data: ClipboardData | null) => void;
}
