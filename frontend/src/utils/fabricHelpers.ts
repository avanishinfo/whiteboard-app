import * as fabric from 'fabric';
import type { DrawingSettings, ShapeType } from '../types';

export function applyObjectDefaults(obj: fabric.Object, settings: DrawingSettings): void {
  obj.set({
    stroke: settings.color,
    strokeWidth: settings.strokeWidth,
    opacity: settings.opacity,
    strokeUniform: true,
    cornerStyle: 'circle',
    cornerSize: 8,
    transparentCorners: false,
    cornerColor: '#2563eb',
    borderColor: '#2563eb',
    borderScaleFactor: 1.5,
  });
}

export function createShape(
  type: ShapeType,
  x: number,
  y: number,
  width: number,
  height: number,
  settings: DrawingSettings
): fabric.Object | null {
  const common = {
    left: x,
    top: y,
    fill: settings.fillColor === 'transparent' ? 'transparent' : settings.fillColor,
    stroke: settings.color,
    strokeWidth: settings.strokeWidth,
    opacity: settings.opacity,
    strokeUniform: true,
  };

  switch (type) {
    case 'rectangle':
      return new fabric.Rect({ ...common, width, height });

    case 'rounded-rectangle':
      return new fabric.Rect({ ...common, width, height, rx: 12, ry: 12 });

    case 'circle': {
      const radius = Math.min(width, height) / 2;
      return new fabric.Circle({ ...common, radius });
    }

    case 'ellipse':
      return new fabric.Ellipse({ ...common, rx: width / 2, ry: height / 2 });

    case 'triangle':
      return new fabric.Triangle({ ...common, width, height });

    case 'diamond': {
      const points = [
        { x: width / 2, y: 0 },
        { x: width, y: height / 2 },
        { x: width / 2, y: height },
        { x: 0, y: height / 2 },
      ];
      return new fabric.Polygon(points, {
        ...common,
        objectCaching: false,
      });
    }

    case 'line':
      return new fabric.Line([x, y, x + width, y + height], {
        stroke: settings.color,
        strokeWidth: settings.strokeWidth,
        opacity: settings.opacity,
        strokeUniform: true,
      });

    case 'arrow': {
      const line = new fabric.Line([0, 0, width, height], {
        stroke: settings.color,
        strokeWidth: settings.strokeWidth,
        opacity: settings.opacity,
        strokeUniform: true,
      });
      // Arrow head using triangle
      const angle = Math.atan2(height, width) * (180 / Math.PI);
      const headSize = Math.max(10, settings.strokeWidth * 4);
      const triangle = new fabric.Triangle({
        left: x + width,
        top: y + height,
        width: headSize,
        height: headSize,
        fill: settings.color,
        stroke: settings.color,
        strokeWidth: 0,
        angle: angle + 90,
        originX: 'center',
        originY: 'center',
      });
      const group = new fabric.Group([line, triangle], {
        left: x,
        top: y,
        opacity: settings.opacity,
      });
      return group;
    }

    default:
      return null;
  }
}

export function createStickyNote(
  x: number,
  y: number,
  text: string,
  bgColor: string
): fabric.Group {
  const width = 200;
  const height = 200;

  const bg = new fabric.Rect({
    width,
    height,
    fill: bgColor,
    rx: 4,
    ry: 4,
    shadow: new fabric.Shadow({
      color: 'rgba(0,0,0,0.15)',
      blur: 8,
      offsetX: 2,
      offsetY: 2,
    }),
    strokeWidth: 0,
  });

  const textObj = new fabric.Textbox(text, {
    left: 12,
    top: 12,
    width: width - 24,
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    fill: '#1a1a1a',
    editable: true,
    splitByGrapheme: false,
  });

  const group = new fabric.Group([bg, textObj], {
    left: x,
    top: y,
    subTargetCheck: true,
  });

  // Tag for identification
  (group as fabric.Group & { stickyNote: boolean }).stickyNote = true;
  (group as fabric.Group & { bgColor: string }).bgColor = bgColor;

  return group;
}

export function getStrokeDashArray(
  style: 'solid' | 'dashed' | 'dotted',
  strokeWidth: number
): number[] | undefined {
  if (style === 'dashed') return [strokeWidth * 4, strokeWidth * 2];
  if (style === 'dotted') return [strokeWidth, strokeWidth * 2];
  return undefined;
}

export function generateId(): string {
  return `obj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}
