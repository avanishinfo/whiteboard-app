import React from 'react';

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  shortcut?: string;
}

export function ToolButton({ icon, label, active, onClick, shortcut }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`
        relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150
        ${active
          ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }
      `}
    >
      {icon}
    </button>
  );
}
