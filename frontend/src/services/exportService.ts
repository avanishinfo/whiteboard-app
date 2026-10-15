import * as fabric from 'fabric';

export async function exportToPNG(canvas: fabric.Canvas): Promise<void> {
  // Fabric v6: toDataURL takes no options object — use canvas element directly
  const el = canvas.toCanvasElement(2);
  const dataURL = el.toDataURL('image/png');
  downloadFile(dataURL, 'board.png');
}

export async function exportToSVG(canvas: fabric.Canvas): Promise<void> {
  const svg = canvas.toSVG();
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  downloadFile(url, 'board.svg');
  URL.revokeObjectURL(url);
}

export function exportToJSON(canvas: fabric.Canvas, boardName: string): void {
  const json = canvas.toJSON();
  const exportData = {
    version: '1.0.0',
    boardName,
    exportedAt: Date.now(),
    canvas: json,
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  downloadFile(url, 'board.json');
  URL.revokeObjectURL(url);
}

export async function importFromJSON(canvas: fabric.Canvas, json: string): Promise<void> {
  const data = JSON.parse(json);
  const canvasData = data.canvas ?? data;
  await canvas.loadFromJSON(canvasData);
  canvas.renderAll();
}

function downloadFile(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
