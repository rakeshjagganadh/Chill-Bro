import React, { useState } from 'react';
import { Button } from '../components/Button';
import { AvatarSelector } from '../components/AvatarSelector';
import { Player } from '../types';
import { AVATARS } from '../constants';

interface ProfileSetupProps {
  gameName: string;
  onComplete: (player: Player) => void;
  onBack: () => void;
}

export const ProfileSetup: React.FC<ProfileSetupProps> = ({ gameName, onComplete, onBack }) => {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const player: Player = {
      id: Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      avatar,
      score: 0,
      isHost: false, // Will be overridden if creating room
    };
    onComplete(player);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <button onClick={onBack} className="text-slate-400 hover:text-white mb-8 flex items-center">
        ← Back
      </button>

      <div className="bg-brand-surface border border-slate-700 rounded-3xl p-8 shadow-xl">
        <h2 className="text-3xl font-display mb-2 text-center">Who dis?</h2>
        <p className="text-center text-slate-400 mb-8">Setup your profile for {gameName}</p>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center mb-6">
                <div className="text-6xl bg-brand-dark rounded-full w-24 h-24 flex items-center justify-center border-4 border-brand-primary">
                    {avatar}
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Nickname</label>
                <input 
                    type="text"
                    maxLength={12}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. ChillMaster69"
                    className="w-full bg-brand-dark border border-slate-600 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                    autoFocus
                />
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Pick an Avatar</label>
                <AvatarSelector selected={avatar} onSelect={setAvatar} />
            </div>

            <Button type="submit" fullWidth disabled={!name.trim()}>
                Let's Go! 🚀
            </Button>
        </form>
      </div>
    </div>
  );
};