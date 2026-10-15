import React, { useEffect, useState } from 'react';
import {
  AlignLeft, AlignCenter, AlignRight, Bold, Layers,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, X,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import * as fabric from 'fabric';

interface PropertiesPanelProps {
  fabricRef: React.RefObject<fabric.Canvas | null>;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onSettingsChange: () => void;
}

const PRESET_COLORS = [
  '#1a1a1a', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#6b7280',
];

const STICKY_COLORS = [
  { bg: '#fef08a', label: 'Yellow' },
  { bg: '#86efac', label: 'Green' },
  { bg: '#93c5fd', label: 'Blue' },
  { bg: '#f9a8d4', label: 'Pink' },
  { bg: '#fdba74', label: 'Orange' },
  { bg: '#c4b5fd', label: 'Purple' },
];

const FONT_FAMILIES = [
  'Inter, sans-serif',
  'Georgia, serif',
  'Courier New, monospace',
  'Arial, sans-serif',
  'Helvetica, sans-serif',
];

export function PropertiesPanel({
  fabricRef,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onSettingsChange,
}: PropertiesPanelProps) {
  const { settings, updateSettings, ui, setRightPanelOpen } = useAppStore();
  const [hasSelection, setHasSelection] = useState(false);
  const [selectionType, setSelectionType] = useState<string>('');

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const onSelectionCreated = () => {
      const obj = canvas.getActiveObject();
      setHasSelection(!!obj);
      setSelectionType(obj?.type ?? '');
    };
    const onSelectionCleared = () => { setHasSelection(false); setSelectionType(''); };

    canvas.on('selection:created', onSelectionCreated);
    canvas.on('selection:updated', onSelectionCreated);
    canvas.on('selection:cleared', onSelectionCleared);

    return () => {
      canvas.off('selection:created', onSelectionCreated);
      canvas.off('selection:updated', onSelectionCreated);
      canvas.off('selection:cleared', onSelectionCleared);
    };
  }, [fabricRef]);

  const update = (partial: Parameters<typeof updateSettings>[0]) => {
    updateSettings(partial);
    setTimeout(onSettingsChange, 0);
  };

  if (!ui.rightPanelOpen) return null;

  const isText = selectionType === 'textbox' || selectionType === 'i-text';
  const isDrawing = ['pencil', 'pen', 'highlighter', 'eraser'].includes(ui.activeTool);

  return (
    <div className="absolute right-3 top-16 bottom-16 z-20 flex flex-col">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg shadow-black/5 w-56 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Properties</span>
          <button
            onClick={() => setRightPanelOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Color */}
          <Section label="Color">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => update({ color: c })}
                  className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
                    settings.color === c ? 'border-blue-500 scale-110' : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.color}
                onChange={(e) => update({ color: e.target.value })}
                className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
              />
              <input
                type="text"
                value={settings.color}
                onChange={(e) => {
                  if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) update({ color: e.target.value });
                }}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-gray-700 focus:outline-none focus:border-blue-400"
              />
            </div>
          </Section>

          {/* Fill color (shapes) */}
          {!isText && !isDrawing && (
            <Section label="Fill">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.fillColor === 'transparent' ? '#ffffff' : settings.fillColor}
                  onChange={(e) => update({ fillColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
                />
                <button
                  onClick={() => update({ fillColor: 'transparent' })}
                  className={`flex-1 text-xs border rounded-lg px-2 py-1.5 transition-colors ${
                    settings.fillColor === 'transparent'
                      ? 'border-blue-400 bg-blue-50 text-blue-600'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Transparent
                </button>
              </div>
            </Section>
          )}

          {/* Stroke width */}
          {!isText && (
            <Section label={`Stroke: ${settings.strokeWidth}px`}>
              <input
                type="range"
                min={1}
                max={32}
                value={settings.strokeWidth}
                onChange={(e) => update({ strokeWidth: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
              <div className="flex gap-1 mt-1">
                {[1, 2, 4, 8].map((w) => (
                  <button
                    key={w}
                    onClick={() => update({ strokeWidth: w })}
                    className={`flex-1 text-xs py-1 rounded border transition-colors ${
                      settings.strokeWidth === w
                        ? 'border-blue-400 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Stroke style */}
          {!isText && (
            <Section label="Stroke Style">
              <div className="flex gap-1">
                {(['solid', 'dashed', 'dotted'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => update({ strokeStyle: s })}
                    className={`flex-1 text-xs py-1.5 rounded border capitalize transition-colors ${
                      settings.strokeStyle === s
                        ? 'border-blue-400 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Opacity */}
          <Section label={`Opacity: ${Math.round(settings.opacity * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.opacity}
              onChange={(e) => update({ opacity: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </Section>

          {/* Text options */}
          {isText && (
            <>
              <Section label="Font">
                <select
                  value={settings.fontFamily}
                  onChange={(e) => update({ fontFamily: e.target.value })}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:border-blue-400"
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f} value={f}>{f.split(',')[0]}</option>
                  ))}
                </select>
              </Section>

              <Section label={`Font Size: ${settings.fontSize}px`}>
                <input
                  type="range"
                  min={8}
                  max={96}
                  value={settings.fontSize}
                  onChange={(e) => update({ fontSize: Number(e.target.value) })}
                  className="w-full accent-blue-600"
                />
                <div className="flex gap-1 mt-1">
                  {[12, 16, 24, 36].map((s) => (
                    <button
                      key={s}
                      onClick={() => update({ fontSize: s })}
                      className={`flex-1 text-xs py-1 rounded border transition-colors ${
                        settings.fontSize === s
                          ? 'border-blue-400 bg-blue-50 text-blue-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Section>

              <Section label="Style & Align">
                <div className="flex gap-1">
                  <button
                    onClick={() => update({ fontWeight: settings.fontWeight === 'bold' ? 'normal' : 'bold' })}
                    className={`flex items-center justify-center w-8 h-8 rounded border transition-colors ${
                      settings.fontWeight === 'bold'
                        ? 'border-blue-400 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Bold size={14} />
                  </button>
                  {(['left', 'center', 'right'] as const).map((align) => {
                    const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
                    return (
                      <button
                        key={align}
                        onClick={() => update({ textAlign: align })}
                        className={`flex items-center justify-center flex-1 h-8 rounded border transition-colors ${
                          settings.textAlign === align
                            ? 'border-blue-400 bg-blue-50 text-blue-600'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={14} />
                      </button>
                    );
                  })}
                </div>
              </Section>
            </>
          )}

          {/* Sticky note colors */}
          {ui.activeTool === 'sticky-note' && (
            <Section label="Note Color">
              <div className="grid grid-cols-3 gap-1.5">
                {STICKY_COLORS.map((c) => (
                  <button
                    key={c.bg}
                    title={c.label}
                    className="w-full h-8 rounded-lg border-2 border-gray-200 hover:scale-105 transition-transform"
                    style={{ backgroundColor: c.bg }}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Layer controls */}
          {hasSelection && (
            <Section label="Layers">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={onBringToFront}
                  title="Bring to Front"
                  className="flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ChevronsUp size={13} /> Front
                </button>
                <button
                  onClick={onSendToBack}
                  title="Send to Back"
                  className="flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ChevronsDown size={13} /> Back
                </button>
                <button
                  onClick={onBringForward}
                  title="Bring Forward"
                  className="flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ChevronUp size={13} /> Forward
                </button>
                <button
                  onClick={onSendBackward}
                  title="Send Backward"
                  className="flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ChevronDown size={13} /> Backward
                </button>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
      {children}
    </div>
  );
}
