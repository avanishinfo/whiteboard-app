import React from 'react';
import {
  MousePointer2, Hand, Pencil, Pen, Highlighter, Eraser,
  Square, Circle, Triangle, Minus, ArrowRight, Type, StickyNote, Image,
  Diamond, RectangleHorizontal,
} from 'lucide-react';
import { ToolButton } from './ToolButton';
import { useAppStore } from '../../store/useAppStore';
import type { ToolType } from '../../types';

interface LeftToolbarProps {
  onImageUpload: () => void;
}

interface ToolGroup {
  label: string;
  tools: { type: ToolType; icon: React.ReactNode; label: string; shortcut?: string }[];
}

export function LeftToolbar({ onImageUpload }: LeftToolbarProps) {
  const { ui, setTool } = useAppStore();

  const toolGroups: ToolGroup[] = [
    {
      label: 'Select',
      tools: [
        { type: 'select', icon: <MousePointer2 size={16} />, label: 'Select', shortcut: 'V' },
        { type: 'pan', icon: <Hand size={16} />, label: 'Pan', shortcut: 'H' },
      ],
    },
    {
      label: 'Draw',
      tools: [
        { type: 'pencil', icon: <Pencil size={16} />, label: 'Pencil', shortcut: 'P' },
        { type: 'pen', icon: <Pen size={16} />, label: 'Pen' },
        { type: 'highlighter', icon: <Highlighter size={16} />, label: 'Highlighter' },
        { type: 'eraser', icon: <Eraser size={16} />, label: 'Eraser', shortcut: 'E' },
      ],
    },
    {
      label: 'Shapes',
      tools: [
        { type: 'rectangle', icon: <Square size={16} />, label: 'Rectangle', shortcut: 'R' },
        { type: 'rounded-rectangle', icon: <RectangleHorizontal size={16} />, label: 'Rounded Rect' },
        { type: 'circle', icon: <Circle size={16} />, label: 'Circle', shortcut: 'C' },
        { type: 'ellipse', icon: <Circle size={14} />, label: 'Ellipse' },
        { type: 'triangle', icon: <Triangle size={16} />, label: 'Triangle' },
        { type: 'diamond', icon: <Diamond size={16} />, label: 'Diamond' },
        { type: 'line', icon: <Minus size={16} />, label: 'Line', shortcut: 'L' },
        { type: 'arrow', icon: <ArrowRight size={16} />, label: 'Arrow' },
      ],
    },
    {
      label: 'Create',
      tools: [
        { type: 'text', icon: <Type size={16} />, label: 'Text', shortcut: 'T' },
        { type: 'sticky-note', icon: <StickyNote size={16} />, label: 'Sticky Note', shortcut: 'N' },
      ],
    },
  ];

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20">
      <div className="flex flex-col gap-1 bg-white border border-gray-200 rounded-xl p-1.5 shadow-lg shadow-black/5">
        {toolGroups.map((group, gi) => (
          <React.Fragment key={group.label}>
            {gi > 0 && <div className="h-px bg-gray-100 my-0.5" />}
            <div className="flex flex-col gap-0.5">
              {group.tools.map((tool) => (
                <ToolButton
                  key={tool.type}
                  icon={tool.icon}
                  label={tool.label}
                  shortcut={tool.shortcut}
                  active={ui.activeTool === tool.type}
                  onClick={() => setTool(tool.type)}
                />
              ))}
            </div>
          </React.Fragment>
        ))}
        <div className="h-px bg-gray-100 my-0.5" />
        <ToolButton
          icon={<Image size={16} />}
          label="Upload Image"
          active={ui.activeTool === 'image'}
          onClick={onImageUpload}
        />
      </div>
    </div>
  );
}
