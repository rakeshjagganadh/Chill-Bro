import React from 'react';
import { AVATARS } from '../constants';

interface AvatarSelectorProps {
  selected: string;
  onSelect: (avatar: string) => void;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({ selected, onSelect }) => {
  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-4 p-4 bg-brand-surface rounded-2xl border border-slate-700 max-h-48 overflow-y-auto custom-scrollbar">
      {AVATARS.map((avatar) => (
        <button
          key={avatar}
          onClick={() => onSelect(avatar)}
          className={`text-2xl sm:text-3xl p-2 rounded-full transition-transform hover:scale-110 flex items-center justify-center aspect-square
            ${selected === avatar ? 'bg-brand-primary ring-2 ring-white scale-110' : 'bg-slate-800 hover:bg-slate-700'}
          `}
        >
          {avatar}
        </button>
      ))}
    </div>
  );
};