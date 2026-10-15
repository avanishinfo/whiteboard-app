import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface BottomBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFitScreen: () => void;
}

export function BottomBar({ zoom, onZoomIn, onZoomOut, onZoomReset, onFitScreen }: BottomBarProps) {
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg shadow-black/5 flex items-center px-2 py-1 gap-1">
        <button
          onClick={onZoomOut}
          title="Zoom Out (-)"
          className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors text-xs"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={onZoomReset}
          title="Reset Zoom (100%)"
          className="text-xs font-medium text-gray-600 hover:text-blue-600 px-2 min-w-[52px] text-center transition-colors"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={onZoomIn}
          title="Zoom In (+)"
          className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
        >
          <ZoomIn size={14} />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button
          onClick={onFitScreen}
          title="Fit to Screen"
          className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
        >
          <Maximize2 size={14} />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <span className="text-xs text-gray-400 px-1">
          Space: Pan · Scroll: Zoom · Del: Delete
        </span>
      </div>
    </div>
  );
}
