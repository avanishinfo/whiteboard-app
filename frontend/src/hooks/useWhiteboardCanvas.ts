import { useEffect, useRef, useCallback, useState } from 'react';
import * as fabric from 'fabric';
import { useAppStore } from '../store/useAppStore';
import { saveBoard, loadBoard } from '../services/persistence';
import { createShape, createStickyNote, getStrokeDashArray, generateId, snapToGrid } from '../utils/fabricHelpers';
import type { ShapeType } from '../types';

const HISTORY_LIMIT = 100;
const AUTOSAVE_INTERVAL = 2000;
const STICKY_COLORS = ['#fef08a', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74', '#c4b5fd'];

// ── Native canvas grid renderer (zero Fabric object overhead) ─────────────────
// Called inside fabric's after:render — draws directly to the lower canvas ctx.
function renderGridNative(
  lowerCanvas: HTMLCanvasElement,
  vpt: number[],
  zoom: number,
  gridSize: number,
  show: boolean,
) {
  const ctx = lowerCanvas.getContext('2d');
  if (!ctx) return;
  if (!show) return;

  const w = lowerCanvas.width;
  const h = lowerCanvas.height;

  // Effective grid spacing in screen pixels; skip rendering if too dense
  const spacing = gridSize * zoom;
  if (spacing < 4) return;

  const offsetX = vpt[4] % spacing;
  const offsetY = vpt[5] % spacing;

  ctx.save();
  // destination-over draws BEHIND already-painted pixels — grid stays under all objects
  ctx.globalCompositeOperation = 'destination-over';
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(190, 205, 220, 0.6)';
  ctx.lineWidth = 1;

  for (let x = offsetX; x < w; x += spacing) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = offsetY; y < h; y += spacing) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }

  ctx.stroke();
  ctx.restore();
}

// Fabric v6 canvas dimension setter
function setCanvasSize(canvas: fabric.Canvas, w: number, h: number) {
  canvas.width = w;
  canvas.height = h;
  (canvas as unknown as { _initRetinaScaling: () => void })._initRetinaScaling?.();
  canvas.calcOffset();
  canvas.renderAll();
}

export function useWhiteboardCanvas(containerRef: React.RefObject<HTMLDivElement | null>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isHistoryActionRef = useRef(false);
  const drawingRef = useRef<fabric.FabricObject | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spaceDownRef = useRef(false);
  // Initialized with defaults; synced from ui state in the effect below.
  const gridConfigRef = useRef({ show: true, gridSize: 20 });
  const [isReady, setIsReady] = useState(false);
  const [objectCount, setObjectCount] = useState(0);

  const { ui, settings, setZoom, setPan, setTool } = useAppStore();

  // Keep gridConfigRef in sync so the after:render callback always reads
  // the latest show/gridSize without needing to re-register.
  useEffect(() => {
    gridConfigRef.current = { show: ui.showGrid, gridSize: ui.gridSize };
    // Trigger one repaint so the grid appears / disappears immediately.
    fabricRef.current?.renderAll();
  }, [ui.showGrid, ui.gridSize]);

  // ── History ──────────────────────────────────────────────────────────────────

  const pushHistory = useCallback((canvas: fabric.Canvas) => {
    if (isHistoryActionRef.current) return;
    const json = JSON.stringify(canvas.toJSON());
    const idx = historyIndexRef.current;
    historyRef.current = historyRef.current.slice(0, idx + 1);
    historyRef.current.push(json);
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const undo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    isHistoryActionRef.current = true;
    canvas.loadFromJSON(historyRef.current[historyIndexRef.current]).then(() => {
      canvas.renderAll();
      isHistoryActionRef.current = false;
      setObjectCount(canvas.getObjects().length);
    });
  }, []);

  const redo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    isHistoryActionRef.current = true;
    canvas.loadFromJSON(historyRef.current[historyIndexRef.current]).then(() => {
      canvas.renderAll();
      isHistoryActionRef.current = false;
      setObjectCount(canvas.getObjects().length);
    });
  }, []);

  // ── Zoom / Pan helpers ───────────────────────────────────────────────────────

  const zoomTo = useCallback((canvas: fabric.Canvas, zoom: number, point?: fabric.Point) => {
    const clamped = Math.min(Math.max(zoom, 0.05), 20);
    const center = point ?? new fabric.Point(canvas.width / 2, canvas.height / 2);
    canvas.zoomToPoint(center, clamped);
    setZoom(clamped);
    // Grid redraws automatically via after:render — no extra call needed.
  }, [setZoom]);

  const fitToScreen = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    if (objects.length === 0) {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      setZoom(1);
      setPan(0, 0);
      canvas.renderAll();
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach((o) => {
      const br = o.getBoundingRect();
      minX = Math.min(minX, br.left);
      minY = Math.min(minY, br.top);
      maxX = Math.max(maxX, br.left + br.width);
      maxY = Math.max(maxY, br.top + br.height);
    });
    const padding = 80;
    const bw = maxX - minX, bh = maxY - minY;
    const scaleX = (canvas.width - padding * 2) / bw;
    const scaleY = (canvas.height - padding * 2) / bh;
    const scale = Math.min(scaleX, scaleY, 2);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const tx = canvas.width / 2 - cx * scale;
    const ty = canvas.height / 2 - cy * scale;
    canvas.setViewportTransform([scale, 0, 0, scale, tx, ty]);
    setZoom(scale);
    setPan(tx, ty);
    canvas.renderAll();
  }, [setZoom, setPan]);

  // ── Apply settings to selected objects ───────────────────────────────────────

  const applySettingsToSelected = useCallback((canvas: fabric.Canvas) => {
    const active = canvas.getActiveObject();
    if (!active) return;
    const objs = active.type === 'activeSelection'
      ? (active as fabric.ActiveSelection).getObjects()
      : [active];

    objs.forEach((obj) => {
      if (obj.type === 'path' || obj.type === 'line') {
        obj.set({ stroke: settings.color, strokeWidth: settings.strokeWidth, opacity: settings.opacity });
      } else if (obj.type === 'textbox' || obj.type === 'i-text') {
        obj.set({
          fill: settings.color,
          fontSize: settings.fontSize,
          fontFamily: settings.fontFamily,
          fontWeight: settings.fontWeight,
          textAlign: settings.textAlign,
          opacity: settings.opacity,
        } as Partial<fabric.Textbox>);
      } else {
        obj.set({
          stroke: settings.color,
          strokeWidth: settings.strokeWidth,
          fill: settings.fillColor === 'transparent' ? 'transparent' : settings.fillColor,
          opacity: settings.opacity,
          strokeDashArray: getStrokeDashArray(settings.strokeStyle, settings.strokeWidth) ?? [],
        });
      }
    });
    canvas.renderAll();
  }, [settings]);

  // ── Canvas initialization ─────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: container.clientWidth,
      height: container.clientHeight,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    });

    fabricRef.current = canvas;

    // ── Register the native grid renderer ────────────────────────────────────
    // after:render fires after every Fabric repaint. We draw on top of the
    // lower canvas (background) before the upper (interaction) layer.
    const lowerCanvas = canvas.lowerCanvasEl as HTMLCanvasElement;

    const onAfterRender = () => {
      const vpt = canvas.viewportTransform!;
      const zoom = canvas.getZoom();
      const { show, gridSize } = gridConfigRef.current;
      renderGridNative(lowerCanvas, vpt, zoom, gridSize, show);
    };

    canvas.on('after:render', onAfterRender);

    // Sync initial zoom to store (clears any stale NaN from localStorage)
    setZoom(canvas.getZoom());

    // Load persisted board
    loadBoard().then((data) => {
      if (data?.canvasJSON) {
        try {
          canvas.loadFromJSON(data.canvasJSON).then(() => {
            canvas.renderAll();
            pushHistory(canvas);
            setObjectCount(canvas.getObjects().length);
          });
        } catch {
          pushHistory(canvas);
        }
      } else {
        pushHistory(canvas);
      }
      setIsReady(true);
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      setCanvasSize(canvas, container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

    // Autosave
    autosaveTimerRef.current = setInterval(async () => {
      const json = JSON.stringify(canvas.toJSON());
      await saveBoard(json, useAppStore.getState().boardName);
    }, AUTOSAVE_INTERVAL);

    return () => {
      resizeObserver.disconnect();
      if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current);
      canvas.off('after:render', onAfterRender);
      canvas.dispose();
      fabricRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tool-driven mouse/wheel event handlers ────────────────────────────────────

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const activeTool = ui.activeTool;

    canvas.isDrawingMode = false;
    canvas.selection = activeTool === 'select';

    canvas.getObjects().forEach((obj) => {
      obj.selectable = activeTool === 'select';
      obj.evented = activeTool === 'select';
    });

    // Free-drawing brushes
    if (activeTool === 'pencil' || activeTool === 'pen' || activeTool === 'highlighter') {
      canvas.isDrawingMode = true;
      const brush = new fabric.PencilBrush(canvas);
      brush.color = activeTool === 'highlighter' ? settings.color + '80' : settings.color;
      brush.width = activeTool === 'highlighter' ? settings.strokeWidth * 6 : settings.strokeWidth;
      canvas.freeDrawingBrush = brush;
    }

    if (activeTool === 'eraser') {
      canvas.isDrawingMode = true;
      const eraser = new fabric.PencilBrush(canvas);
      eraser.color = '#ffffff';
      eraser.width = settings.strokeWidth * 8;
      canvas.freeDrawingBrush = eraser;
    }

    let isMouseDown = false;

    const onMouseDown = (e: fabric.TPointerEventInfo) => {
      const pointer = canvas.getScenePoint(e.e as MouseEvent);

      if (spaceDownRef.current || activeTool === 'pan') {
        isPanningRef.current = true;
        lastPanPointRef.current = { x: (e.e as MouseEvent).clientX, y: (e.e as MouseEvent).clientY };
        canvas.setCursor('grabbing');
        return;
      }

      if (activeTool === 'select') return;
      if (['pencil', 'pen', 'highlighter', 'eraser'].includes(activeTool)) return;

      const sx = ui.snapToGrid ? snapToGrid(pointer.x, ui.gridSize) : pointer.x;
      const sy = ui.snapToGrid ? snapToGrid(pointer.y, ui.gridSize) : pointer.y;
      startPointRef.current = { x: sx, y: sy };
      isMouseDown = true;

      if (activeTool === 'text') {
        const text = new fabric.Textbox('Type here...', {
          left: sx, top: sy,
          fontSize: settings.fontSize, fontFamily: settings.fontFamily,
          fontWeight: settings.fontWeight, fill: settings.color,
          opacity: settings.opacity, width: 200, editable: true,
        });
        ((text as unknown) as { id: string }).id = generateId();
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        pushHistory(canvas);
        setObjectCount(canvas.getObjects().length);
        setTool('select');
        return;
      }

      if (activeTool === 'sticky-note') {
        const colorIndex = Math.floor(Math.random() * STICKY_COLORS.length);
        const note = createStickyNote(sx, sy, 'Click to edit...', STICKY_COLORS[colorIndex]);
        ((note as unknown) as { id: string }).id = generateId();
        canvas.add(note);
        canvas.setActiveObject(note);
        pushHistory(canvas);
        setObjectCount(canvas.getObjects().length);
        setTool('select');
        return;
      }

      if (activeTool === 'image') return;

      const shapeTypes: Record<string, ShapeType> = {
        rectangle: 'rectangle', 'rounded-rectangle': 'rounded-rectangle',
        circle: 'circle', ellipse: 'ellipse', triangle: 'triangle',
        diamond: 'diamond', line: 'line', arrow: 'arrow',
      };
      const shapeType = shapeTypes[activeTool as string];
      if (!shapeType) return;

      const shape = createShape(shapeType, sx, sy, 0, 0, settings);
      if (shape) {
        ((shape as unknown) as { id: string }).id = generateId();
        canvas.add(shape);
        drawingRef.current = shape;
      }
    };

    const onMouseMove = (e: fabric.TPointerEventInfo) => {
      if (isPanningRef.current && lastPanPointRef.current) {
        const dx = (e.e as MouseEvent).clientX - lastPanPointRef.current.x;
        const dy = (e.e as MouseEvent).clientY - lastPanPointRef.current.y;
        const vpt = canvas.viewportTransform!;
        canvas.setViewportTransform([vpt[0], vpt[1], vpt[2], vpt[3], vpt[4] + dx, vpt[5] + dy]);
        lastPanPointRef.current = { x: (e.e as MouseEvent).clientX, y: (e.e as MouseEvent).clientY };
        // renderAll is called automatically by Fabric during pan
        return;
      }

      if (!isMouseDown || !startPointRef.current || !drawingRef.current) return;

      const pointer = canvas.getScenePoint(e.e as MouseEvent);
      const ex = ui.snapToGrid ? snapToGrid(pointer.x, ui.gridSize) : pointer.x;
      const ey = ui.snapToGrid ? snapToGrid(pointer.y, ui.gridSize) : pointer.y;
      const { x: sx, y: sy } = startPointRef.current;
      const w = ex - sx, h = ey - sy;
      const obj = drawingRef.current;

      if (obj instanceof fabric.Rect) {
        obj.set({ left: w < 0 ? ex : sx, top: h < 0 ? ey : sy, width: Math.abs(w), height: Math.abs(h) });
      } else if (obj instanceof fabric.Circle) {
        obj.set({ left: sx, top: sy, radius: Math.min(Math.abs(w), Math.abs(h)) / 2 });
      } else if (obj instanceof fabric.Ellipse) {
        obj.set({ left: w < 0 ? ex : sx, top: h < 0 ? ey : sy, rx: Math.abs(w) / 2, ry: Math.abs(h) / 2 });
      } else if (obj instanceof fabric.Triangle) {
        obj.set({ left: w < 0 ? ex : sx, top: h < 0 ? ey : sy, width: Math.abs(w), height: Math.abs(h) });
      } else if (obj instanceof fabric.Polygon) {
        canvas.remove(obj);
        const aw = Math.abs(w), ah = Math.abs(h);
        const newDiamond = new fabric.Polygon(
          [{ x: aw / 2, y: 0 }, { x: aw, y: ah / 2 }, { x: aw / 2, y: ah }, { x: 0, y: ah / 2 }],
          {
            left: w < 0 ? ex : sx, top: h < 0 ? ey : sy,
            fill: settings.fillColor === 'transparent' ? 'transparent' : settings.fillColor,
            stroke: settings.color, strokeWidth: settings.strokeWidth,
            opacity: settings.opacity, strokeUniform: true, objectCaching: false,
          }
        ) as fabric.Polygon & { id: string };
        newDiamond.id = ((obj as unknown) as { id: string }).id;
        canvas.add(newDiamond);
        drawingRef.current = newDiamond;
      } else if (obj instanceof fabric.Line) {
        obj.set({ x2: ex, y2: ey });
      } else if (obj instanceof fabric.Group) {
        canvas.remove(obj);
        const newArrow = createShape('arrow', sx, sy, w, h, settings);
        if (newArrow) {
          ((newArrow as unknown) as { id: string }).id = ((obj as unknown) as { id: string }).id;
          canvas.add(newArrow);
          drawingRef.current = newArrow;
        }
      }

      obj.setCoords();
      canvas.renderAll();
    };

    const onMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        lastPanPointRef.current = null;
        const vpt = canvas.viewportTransform!;
        setPan(vpt[4], vpt[5]);
        return;
      }

      if (!isMouseDown) return;
      isMouseDown = false;

      if (drawingRef.current) {
        const obj = drawingRef.current;
        let tooSmall = false;
        if (obj instanceof fabric.Rect) tooSmall = (obj.width ?? 0) < 4 && (obj.height ?? 0) < 4;
        if (obj instanceof fabric.Ellipse) tooSmall = (obj.rx ?? 0) < 2 && (obj.ry ?? 0) < 2;
        if (tooSmall) {
          canvas.remove(obj);
        } else {
          canvas.setActiveObject(obj);
          pushHistory(canvas);
          setObjectCount(canvas.getObjects().length);
        }
        drawingRef.current = null;
        startPointRef.current = null;
        setTool('select');
      }
    };

    // Smooth wheel zoom — requestAnimationFrame throttle
    let rafPending = false;
    let pendingZoom = 0;
    let pendingPoint: fabric.Point | null = null;

    const onWheel = (e: fabric.TPointerEventInfo<WheelEvent>) => {
      e.e.preventDefault();
      e.e.stopPropagation();

      const delta = e.e.deltaY;
      const factor = delta > 0 ? 0.95 : 1.05;
      pendingZoom = pendingZoom === 0
        ? canvas.getZoom() * factor
        : pendingZoom * factor;
      pendingPoint = new fabric.Point(e.e.offsetX, e.e.offsetY);

      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
          const clamped = Math.min(Math.max(pendingZoom, 0.05), 20);
          canvas.zoomToPoint(pendingPoint!, clamped);
          setZoom(clamped);
          pendingZoom = 0;
          pendingPoint = null;
          rafPending = false;
          // after:render fires automatically after zoomToPoint → no manual grid call
        });
      }
    };

    const onPathCreated = () => { pushHistory(canvas); setObjectCount(canvas.getObjects().length); };
    const onObjectModified = () => pushHistory(canvas);
    const onObjectAdded = () => setObjectCount(canvas.getObjects().length);
    const onObjectRemoved = () => setObjectCount(canvas.getObjects().length);

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    canvas.on('mouse:wheel', onWheel);
    canvas.on('path:created', onPathCreated);
    canvas.on('object:modified', onObjectModified);
    canvas.on('object:added', onObjectAdded);
    canvas.on('object:removed', onObjectRemoved);

    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      canvas.off('mouse:wheel', onWheel);
      canvas.off('path:created', onPathCreated);
      canvas.off('object:modified', onObjectModified);
      canvas.off('object:added', onObjectAdded);
      canvas.off('object:removed', onObjectRemoved);
    };
  }, [ui.activeTool, ui.snapToGrid, ui.gridSize, settings, setZoom, setPan, setTool, pushHistory]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') { spaceDownRef.current = true; canvas.setCursor('grab'); e.preventDefault(); return; }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); return; }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        canvas.getActiveObject()?.clone().then((cloned) => {
          useAppStore.getState().setClipboard({ objects: [cloned.toJSON()], offsetX: 20, offsetY: 20 });
        });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        const clip = useAppStore.getState().clipboard;
        if (clip) {
          clip.objects.forEach((objData) => {
            fabric.util.enlivenObjects([objData]).then((objects) => {
              (objects as fabric.FabricObject[]).forEach((obj) => {
                obj.set({ left: (obj.left ?? 0) + clip.offsetX, top: (obj.top ?? 0) + clip.offsetY });
                ((obj as unknown) as { id: string }).id = generateId();
                canvas.add(obj);
                canvas.setActiveObject(obj);
              });
              canvas.renderAll();
              pushHistory(canvas);
            });
          });
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        canvas.getActiveObject()?.clone().then((cloned) => {
          cloned.set({ left: (cloned.left ?? 0) + 20, top: (cloned.top ?? 0) + 20 });
          ((cloned as unknown) as { id: string }).id = generateId();
          canvas.add(cloned);
          canvas.setActiveObject(cloned);
          canvas.renderAll();
          pushHistory(canvas);
        });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const objects = canvas.getObjects();
        if (objects.length > 0) {
          canvas.setActiveObject(new fabric.ActiveSelection(objects, { canvas }));
          canvas.renderAll();
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = canvas.getActiveObject();
        if (active) {
          if (active.type === 'activeSelection') {
            (active as fabric.ActiveSelection).getObjects().forEach((o) => canvas.remove(o));
          } else {
            canvas.remove(active);
          }
          canvas.discardActiveObject();
          canvas.renderAll();
          pushHistory(canvas);
        }
        return;
      }

      if (e.key === 'Escape') { canvas.discardActiveObject(); canvas.renderAll(); setTool('select'); }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceDownRef.current = false; fabricRef.current?.setCursor('default'); }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [undo, redo, pushHistory, setTool]);

  // ── Layer operations ──────────────────────────────────────────────────────────

  const bringForward = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) { canvas.bringObjectForward(obj); pushHistory(canvas); }
  }, [pushHistory]);

  const sendBackward = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) { canvas.sendObjectBackwards(obj); pushHistory(canvas); }
  }, [pushHistory]);

  const bringToFront = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) { canvas.bringObjectToFront(obj); pushHistory(canvas); }
  }, [pushHistory]);

  const sendToBack = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj) { canvas.sendObjectToBack(obj); pushHistory(canvas); }
  }, [pushHistory]);

  // ── Image upload ──────────────────────────────────────────────────────────────

  const addImage = useCallback((file: File | string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const addToCanvas = (url: string) => {
      fabric.FabricImage.fromURL(url).then((img) => {
        const maxW = canvas.width * 0.6, maxH = canvas.height * 0.6;
        if ((img.width ?? 0) > maxW || (img.height ?? 0) > maxH) {
          img.scale(Math.min(maxW / (img.width ?? 1), maxH / (img.height ?? 1)));
        }
        img.set({
          left: (canvas.width - (img.width ?? 0) * (img.scaleX ?? 1)) / 2,
          top: (canvas.height - (img.height ?? 0) * (img.scaleY ?? 1)) / 2,
        });
        ((img as unknown) as { id: string }).id = generateId();
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        pushHistory(canvas);
      });
    };

    if (typeof file === 'string') {
      addToCanvas(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { if (e.target?.result) addToCanvas(e.target.result as string); };
      reader.readAsDataURL(file);
    }
  }, [pushHistory]);

  // ── Zoom controls ─────────────────────────────────────────────────────────────

  const zoomIn = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    zoomTo(canvas, canvas.getZoom() * 1.2);
  }, [zoomTo]);

  const zoomOut = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    zoomTo(canvas, canvas.getZoom() / 1.2);
  }, [zoomTo]);

  const zoomReset = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    setZoom(1);
    setPan(0, 0);
    canvas.renderAll();
  }, [setZoom, setPan]);

  return {
    canvasRef,
    fabricRef,
    isReady,
    objectCount,
    undo,
    redo,
    fitToScreen,
    zoomIn,
    zoomOut,
    zoomReset,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    addImage,
    pushHistory,
    applySettingsToSelected: () => {
      const canvas = fabricRef.current;
      if (canvas) applySettingsToSelected(canvas);
    },
  };
}
