import React, { useState } from 'react';
import { GAMES } from '../constants';
import { GameType } from '../types';
import { Button } from '../components/Button';

interface HomeProps {
  onSelectGame: (type: GameType) => void;
  onJoinGame: (code: string) => void;
}

export const Home: React.FC<HomeProps> = ({ onSelectGame, onJoinGame }) => {
  const [joinCode, setJoinCode] = useState('');

  const handleJoin = (e: React.FormEvent) => {
      e.preventDefault();
      if (joinCode.length >= 5) {
          onJoinGame(joinCode.toUpperCase());
      }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Force upper case and allow only valid characters used in the generator
      // Generator uses: ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (Excludes I, 1, O, 0)
      const val = e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '');
      setJoinCode(val);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-6xl md:text-8xl font-display text-transparent bg-clip-text bg-gradient-to-r from-brand-secondary to-brand-accent mb-4 animate-pulse-slow">
          Chill Bro
        </h1>
        <p className="text-slate-400 text-xl font-light">
          No login. No install. Just pure chaos.
        </p>
      </div>
      
      {/* Join Game Section */}
      <div className="max-w-md mx-auto mb-16 bg-brand-surface/50 border border-slate-700 rounded-3xl p-6 backdrop-blur-sm shadow-xl">
          <form onSubmit={handleJoin} className="flex gap-2">
              <input 
                  type="text" 
                  placeholder="ENTER CODE" 
                  value={joinCode}
                  onChange={handleInputChange}
                  className="flex-grow bg-brand-dark border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 font-mono text-lg uppercase tracking-widest focus:outline-none focus:border-brand-primary transition-colors"
                  maxLength={5}
              />
              <Button type="submit" disabled={joinCode.length < 5}>
                  Join
              </Button>
          </form>
          <div className="text-center mt-2 text-xs text-slate-500">
             Have a code? Paste it above to jump in!
          </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {GAMES.map((game) => (
          <div 
            key={game.id}
            onClick={() => onSelectGame(game.id)}
            className="group relative bg-brand-surface border border-slate-700 rounded-3xl p-8 hover:border-brand-primary transition-all duration-300 cursor-pointer hover:-translate-y-2 hover:shadow-2xl hover:shadow-brand-primary/20 overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 ${game.color} opacity-10 blur-[50px] rounded-full group-hover:opacity-20 transition-opacity`} />
            
            <div className="text-6xl mb-6 transform group-hover:scale-110 transition-transform duration-300 origin-left">
              {game.icon}
            </div>
            <h2 className="text-3xl font-bold mb-3 font-display">{game.title}</h2>
            <p className="text-slate-400 leading-relaxed">{game.description}</p>
            
            <div className="mt-8 flex items-center text-brand-primary font-bold group-hover:translate-x-2 transition-transform">
              Create Room <span className="ml-2">→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};