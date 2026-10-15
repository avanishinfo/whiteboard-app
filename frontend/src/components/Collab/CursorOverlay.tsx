// Renders other users' cursors on top of the whiteboard canvas.
// Positions are in Fabric.js scene (canvas) coordinates and converted to screen
// coordinates using the viewport transform so they stay correct at any zoom/pan.
import * as fabric from 'fabric';
import { useAppStore } from '../../store/useAppStore';
import type { RemoteUser } from '../../hooks/useCollaboration';

interface Props {
  fabricRef: React.RefObject<fabric.Canvas | null>;
  remoteUsers: Map<string, RemoteUser>;
}

export function CursorOverlay({ fabricRef, remoteUsers }: Props) {
  // Re-render whenever zoom or pan changes
  const _zoom = useAppStore(s => s.ui.zoom);
  const _panX = useAppStore(s => s.ui.panX);
  const _panY = useAppStore(s => s.ui.panY);
  void _zoom; void _panX; void _panY;

  const canvas = fabricRef.current;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {Array.from(remoteUsers.values()).map((user) => {
        if (user.cursorX === null || user.cursorY === null) return null;

        // Convert canvas scene coords → screen coords via viewport transform
        let screenX = user.cursorX;
        let screenY = user.cursorY;
        if (canvas) {
          const vpt = canvas.viewportTransform!;
          screenX = user.cursorX * vpt[0] + vpt[4];
          screenY = user.cursorY * vpt[3] + vpt[5];
        }

        // Abbreviated label: first 4 chars of user ID
        const label = user.id.slice(0, 4);

        return (
          <div
            key={user.id}
            style={{ position: 'absolute', left: screenX, top: screenY, transform: 'translate(-4px, -4px)' }}
          >
            {/* Cursor dot */}
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: user.color,
                border: '2px solid white',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              }}
            />
            {/* Name tag */}
            <div
              style={{
                marginTop: 4,
                padding: '2px 6px',
                borderRadius: 6,
                backgroundColor: user.color,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                lineHeight: 1.4,
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
