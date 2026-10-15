import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppStore, ToolType, DrawingSettings, UIState, ClipboardData } from '../types';

const defaultSettings: DrawingSettings = {
  color: '#1a1a1a',
  strokeWidth: 2,
  opacity: 1,
  fillColor: 'transparent',
  fontSize: 16,
  fontFamily: 'Inter, sans-serif',
  fontWeight: 'normal',
  textAlign: 'left',
  strokeStyle: 'solid',
  snapToGrid: false,
};

const defaultUI: UIState = {
  activeTool: 'select',
  showGrid: true,
  snapToGrid: false,
  gridSize: 20,
  selectedObjectIds: [],
  isPanning: false,
  isDrawing: false,
  zoom: 1,
  panX: 0,
  panY: 0,
  rightPanelOpen: true,
  leftPanelOpen: true,
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ui: defaultUI,
      settings: defaultSettings,
      boardName: 'Untitled Board',
      clipboard: null,

      setTool: (tool: ToolType) =>
        set((state) => ({ ui: { ...state.ui, activeTool: tool } })),

      setZoom: (zoom: number) =>
        set((state) => ({
          ui: { ...state.ui, zoom: isNaN(zoom) ? 1 : Math.min(Math.max(zoom, 0.05), 20) },
        })),

      setPan: (panX: number, panY: number) =>
        set((state) => ({ ui: { ...state.ui, panX, panY } })),

      toggleGrid: () =>
        set((state) => ({ ui: { ...state.ui, showGrid: !state.ui.showGrid } })),

      toggleSnapToGrid: () =>
        set((state) => ({
          ui: { ...state.ui, snapToGrid: !state.ui.snapToGrid },
          settings: { ...state.settings, snapToGrid: !state.ui.snapToGrid },
        })),

      setGridSize: (size: number) =>
        set((state) => ({ ui: { ...state.ui, gridSize: size } })),

      setRightPanelOpen: (open: boolean) =>
        set((state) => ({ ui: { ...state.ui, rightPanelOpen: open } })),

      updateSettings: (partial: Partial<DrawingSettings>) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),

      setBoardName: (name: string) => set({ boardName: name }),

      setClipboard: (data: ClipboardData | null) => set({ clipboard: data }),
    }),
    {
      name: 'whiteboard-settings',
      partialize: (state) => ({
        settings: state.settings,
        boardName: state.boardName,
        ui: {
          showGrid: state.ui.showGrid,
          snapToGrid: state.ui.snapToGrid,
          gridSize: state.ui.gridSize,
        },
      }),
    }
  )
);
