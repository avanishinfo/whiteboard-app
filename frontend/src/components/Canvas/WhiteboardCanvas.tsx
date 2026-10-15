import React, { useRef, useCallback } from 'react';
import { useWhiteboardCanvas } from '../../hooks/useWhiteboardCanvas';
import { useCollaboration } from '../../hooks/useCollaboration';
import { useAppStore } from '../../store/useAppStore';
import { TopBar } from '../Toolbar/TopBar';
import { LeftToolbar } from '../Toolbar/LeftToolbar';
import { PropertiesPanel } from '../Properties/PropertiesPanel';
import { BottomBar } from './BottomBar';
import { CursorOverlay } from '../Collab/CursorOverlay';
import { CollabStatus } from '../Collab/CollabStatus';

export function WhiteboardCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { ui } = useAppStore();

  const {
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
    applySettingsToSelected,
  } = useWhiteboardCanvas(containerRef);

  const { connectionStatus, roomId, myColor, remoteUsers } = useCollaboration(fabricRef, isReady);

  const handleImageUpload = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleImageFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addImage(file);
    e.target.value = '';
  }, [addImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      addImage(file);
    }
  }, [addImage]);

  const getCursorClass = () => {
    switch (ui.activeTool) {
      case 'pan': return 'cursor-grab';
      case 'pencil':
      case 'pen':
      case 'highlighter': return 'cursor-crosshair';
      case 'eraser': return 'cursor-eraser';
      case 'text': return 'cursor-text';
      case 'rectangle':
      case 'rounded-rectangle':
      case 'circle':
      case 'ellipse':
      case 'triangle':
      case 'diamond':
      case 'line':
      case 'arrow': return 'cursor-crosshair';
      default: return 'cursor-default';
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-50 overflow-hidden select-none">
      {/* Canvas container */}
      <div
        ref={containerRef}
        className={`absolute inset-0 ${getCursorClass()}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} />
      </div>

      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 bg-white flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 text-sm">Loading board...</p>
          </div>
        </div>
      )}

      {/* Remote cursors overlay — always present once canvas is ready */}
      {isReady && (
        <CursorOverlay fabricRef={fabricRef} remoteUsers={remoteUsers} />
      )}

      {/* UI Layer */}
      {isReady && (
        <>
          {/* Collaboration status — top-right corner */}
          <div className="absolute top-3 right-3 z-30">
            <CollabStatus
              status={connectionStatus}
              roomId={roomId}
              userCount={remoteUsers.size + 1}
              myColor={myColor}
            />
          </div>

          <TopBar
            fabricRef={fabricRef}
            onUndo={undo}
            onRedo={redo}
            onFitScreen={fitToScreen}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            objectCount={objectCount}
          />
          <LeftToolbar onImageUpload={handleImageUpload} />
          <PropertiesPanel
            fabricRef={fabricRef}
            onBringForward={bringForward}
            onSendBackward={sendBackward}
            onBringToFront={bringToFront}
            onSendToBack={sendToBack}
            onSettingsChange={applySettingsToSelected}
          />
          <BottomBar
            zoom={ui.zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomReset={zoomReset}
            onFitScreen={fitToScreen}
          />
        </>
      )}

      {/* Hidden inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpg,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={handleImageFile}
      />
    </div>
  );
}
