import React, { useRef, useState } from 'react';
import {
  Undo2, Redo2, Download, Upload, FileJson, ImageIcon, FileText,
  Grid3X3, Magnet, Trash2, ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import * as fabric from 'fabric';
import { exportToPNG, exportToSVG, exportToJSON, importFromJSON } from '../../services/exportService';
import { clearBoard } from '../../services/persistence';

interface TopBarProps {
  fabricRef: React.RefObject<fabric.Canvas | null>;
  onUndo: () => void;
  onRedo: () => void;
  onFitScreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  objectCount: number;
}

export function TopBar({ fabricRef, onUndo, onRedo, onFitScreen, onZoomIn, onZoomOut, objectCount }: TopBarProps) {
  const { ui, boardName, setBoardName, toggleGrid, toggleSnapToGrid } = useAppStore();
  const [editingName, setEditingName] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const handleExportPNG = async () => {
    const canvas = fabricRef.current;
    if (canvas) await exportToPNG(canvas);
    setExportMenuOpen(false);
  };

  const handleExportSVG = async () => {
    const canvas = fabricRef.current;
    if (canvas) await exportToSVG(canvas);
    setExportMenuOpen(false);
  };

  const handleExportJSON = () => {
    const canvas = fabricRef.current;
    if (canvas) exportToJSON(canvas, boardName);
    setExportMenuOpen(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const canvas = fabricRef.current;
      if (!canvas || !ev.target?.result) return;
      try {
        await importFromJSON(canvas, ev.target.result as string);
      } catch {
        alert('Failed to import board. Please check the file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearBoard = () => {
    if (!confirm('Clear the entire board? This cannot be undone.')) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getObjects()
      .filter((o) => !(o as fabric.Object & { isGrid?: boolean }).isGrid)
      .forEach((o) => canvas.remove(o));
    canvas.discardActiveObject();
    canvas.renderAll();
    clearBoard();
  };

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
      {/* Board name */}
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-lg shadow-black/5">
        {editingName ? (
          <input
            autoFocus
            value={boardName}
            onChange={(e) => setBoardName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
            className="text-sm font-semibold text-gray-800 bg-transparent outline-none border-b border-blue-400 min-w-[120px]"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors"
          >
            {boardName}
          </button>
        )}
      </div>

      {/* History */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg shadow-black/5 flex items-center p-1">
        <button
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <Undo2 size={15} />
        </button>
        <button
          onClick={onRedo}
          title="Redo (Ctrl+Y)"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <Redo2 size={15} />
        </button>
      </div>

      {/* View controls */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg shadow-black/5 flex items-center p-1 gap-0.5">
        <button
          onClick={toggleGrid}
          title="Toggle Grid"
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
            ui.showGrid ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Grid3X3 size={15} />
        </button>
        <button
          onClick={toggleSnapToGrid}
          title="Snap to Grid"
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
            ui.snapToGrid ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Magnet size={15} />
        </button>
        <div className="w-px h-5 bg-gray-200 mx-0.5" />
        <button
          onClick={onZoomOut}
          title="Zoom Out"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ZoomOut size={15} />
        </button>
        <span className="text-xs font-medium text-gray-600 px-1 min-w-[44px] text-center">
          {Math.round(ui.zoom * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          title="Zoom In"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={onFitScreen}
          title="Fit to Screen"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <Maximize2 size={15} />
        </button>
      </div>

      {/* Import/Export */}
      <div className="relative">
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg shadow-black/5 flex items-center p-1 gap-0.5">
          <button
            onClick={() => importRef.current?.click()}
            title="Import Board"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Upload size={15} />
          </button>
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            title="Export"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Download size={15} />
          </button>
          <div className="w-px h-5 bg-gray-200 mx-0.5" />
          <button
            onClick={handleClearBoard}
            title="Clear Board"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {exportMenuOpen && (
          <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-xl shadow-xl p-1 min-w-[160px] z-50">
            <button
              onClick={handleExportPNG}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ImageIcon size={14} /> Export PNG
            </button>
            <button
              onClick={handleExportSVG}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FileText size={14} /> Export SVG
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FileJson size={14} /> Export JSON
            </button>
          </div>
        )}
      </div>

      {/* Object count badge */}
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-lg shadow-black/5">
        <span className="text-xs text-gray-500">{objectCount} objects</span>
      </div>

      <input
        ref={importRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />

      {exportMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
      )}
    </div>
  );
}
