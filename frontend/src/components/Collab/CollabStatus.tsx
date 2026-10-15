// Connection status badge + user presence count shown in the top-right corner.
import { Users, Wifi, WifiOff, Loader2 } from 'lucide-react';
import type { ConnectionStatus } from '../../services/websocket';

interface Props {
  status: ConnectionStatus;
  roomId: string;
  userCount: number; // total users including yourself
  myColor: string | null;
}

export function CollabStatus({ status, roomId, userCount, myColor }: Props) {
  if (status === 'disabled') return null; // no VITE_WS_URL — silent

  const config = {
    connected:    { icon: <Wifi size={13} />,    label: 'Live',          dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-200' },
    connecting:   { icon: <Loader2 size={13} className="animate-spin" />, label: 'Connecting…', dot: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
    disconnected: { icon: <WifiOff size={13} />,  label: 'Reconnecting…', dot: 'bg-red-400',   text: 'text-red-700',   bg: 'bg-red-50 border-red-200'   },
  }[status];

  return (
    <div className="flex items-center gap-2">
      {/* Room pill */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-gray-200 shadow-sm shadow-black/5 text-xs text-gray-600">
        <Users size={12} className="text-gray-400" />
        <span className="font-medium">{roomId}</span>
        {userCount > 1 && (
          <span
            className="ml-0.5 px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold"
            style={{ backgroundColor: myColor ?? '#3b82f6' }}
          >
            {userCount}
          </span>
        )}
      </div>

      {/* Connection status pill */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${config.bg} ${config.text}`}>
        {config.icon}
        {config.label}
      </div>
    </div>
  );
}
