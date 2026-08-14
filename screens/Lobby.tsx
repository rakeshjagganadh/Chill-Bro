import React, { useEffect, useState } from 'react';
import { Player, Room, GameType, MovieCategory } from '../types';
import { Button } from '../components/Button';
import { socket } from '../services/mockSocket';
import { DEFAULT_SETTINGS } from '../constants';

interface LobbyProps {
  room: Room;
  currentPlayerId: string;
}

export const Lobby: React.FC<LobbyProps> = ({ room, currentPlayerId }) => {
  const isHost = room.players.find(p => p.id === currentPlayerId)?.isHost;
  const [copied, setCopied] = useState(false);

  // Local state for host controls
  const [rounds, setRounds] = useState(room.settings.rounds);
  const [timer, setTimer] = useState(room.settings.timerSeconds);
  const [category, setCategory] = useState<MovieCategory>(room.settings.category || MovieCategory.ENGLISH);

  useEffect(() => {
    // Sync local state if room updates externally (from other events)
    setRounds(room.settings.rounds);
    setTimer(room.settings.timerSeconds);
    if (room.settings.category) setCategory(room.settings.category);
  }, [room.settings]);

  const handleShareOrCopy = async () => {
    const shareData = {
        title: 'Join my Chill Bro Game',
        text: `Join my Chill Bro party game with code: ${room.code}`,
        url: window.location.href
    };

    // Try Native Share First (Mobile)
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            return;
        } catch (err) {
            console.log("Share cancelled or failed, falling back to copy");
        }
    }
    
    // Fallback to clipboard
    try {
        await navigator.clipboard.writeText(room.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    } catch (err) {
        // Fallback for non-secure contexts or legacy browsers if clipboard API fails
        try {
            const textArea = document.createElement("textarea");
            textArea.value = room.code;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error("Copy failed", e);
            alert(`Code: ${room.code}`); // Last resort
        }
    }
  };

  const handleSettingsChange = () => {
      socket.updateSettings({ rounds, timerSeconds: timer, category });
  };

  // Auto-save settings when controls change
  useEffect(() => {
      if (isHost) {
          handleSettingsChange();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds, timer, category]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column: Room Info & Settings */}
        <div className="space-y-6">
          <div className="bg-brand-surface border border-slate-700 rounded-3xl p-6">
            <h2 className="text-xl text-slate-400 mb-2 font-bold uppercase tracking-wider">Room Code</h2>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-mono font-bold text-brand-secondary bg-brand-dark px-4 py-2 rounded-lg tracking-[0.2em] select-all">
                {room.code}
              </div>
              <button 
                onClick={handleShareOrCopy}
                className="bg-brand-primary hover:bg-indigo-600 transition-colors px-4 py-3 rounded-lg font-bold flex items-center gap-2"
                title="Copy or Share Code"
              >
                {copied ? 'Copied!' : 'Share / Copy 📤'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">Share this code with your friends so they can join!</p>
          </div>

          {isHost && (
            <div className="bg-brand-surface border border-slate-700 rounded-3xl p-6 space-y-6">
               <h3 className="text-xl font-bold font-display border-b border-slate-700 pb-2">Game Settings</h3>
               
               <div>
                 <label className="block text-sm text-slate-400 mb-2">Number of Rounds: <span className="text-white font-bold">{rounds}</span></label>
                 <input 
                   type="range" min="1" max="10" 
                   value={rounds} onChange={(e) => setRounds(parseInt(e.target.value))}
                   className="w-full accent-brand-secondary h-2 bg-brand-dark rounded-lg appearance-none cursor-pointer"
                 />
               </div>

               <div>
                 <label className="block text-sm text-slate-400 mb-2">Round Timer: <span className="text-white font-bold">{timer}s</span></label>
                 <input 
                   type="range" min="10" max="120" step="5"
                   value={timer} onChange={(e) => setTimer(parseInt(e.target.value))}
                   className="w-full accent-brand-secondary h-2 bg-brand-dark rounded-lg appearance-none cursor-pointer"
                 />
               </div>

               {room.gameType === GameType.CINE_QUIZ && (
                   <div>
                       <label className="block text-sm text-slate-400 mb-2">Movie Category</label>
                       <div className="grid grid-cols-3 gap-2">
                           {Object.values(MovieCategory).map(cat => (
                               <button
                                 key={cat}
                                 onClick={() => setCategory(cat)}
                                 className={`p-2 text-sm rounded-lg border ${category === cat ? 'bg-brand-accent border-brand-accent text-white' : 'bg-brand-dark border-slate-600 text-slate-400'}`}
                               >
                                   {cat}
                               </button>
                           ))}
                       </div>
                   </div>
               )}
            </div>
          )}

           {!isHost && (
                <div className="bg-brand-surface border border-slate-700 rounded-3xl p-6 text-center">
                    <p className="text-slate-400 animate-pulse">Waiting for host to start...</p>
                    <div className="mt-4 text-sm text-slate-500">
                        {room.settings.rounds} Rounds • {room.settings.timerSeconds}s Timer
                        {room.settings.category && ` • ${room.settings.category}`}
                    </div>
                </div>
           )}
        </div>

        {/* Right Column: Player List */}
        <div className="flex flex-col h-full">
            <div className="bg-brand-surface border border-slate-700 rounded-3xl p-6 flex-grow flex flex-col">
                <h3 className="text-xl font-bold font-display mb-4 flex justify-between items-center">
                    Players <span className="bg-brand-dark text-brand-primary px-3 py-1 rounded-full text-sm">{room.players.length}</span>
                </h3>
                
                <div className="space-y-3 flex-grow overflow-y-auto max-h-[400px]">
                    {room.players.map((player) => (
                        <div key={player.id} className="flex items-center gap-4 bg-brand-dark p-3 rounded-xl border border-slate-700 animate-bounce-small">
                            <div className="text-3xl">{player.avatar}</div>
                            <div className="font-bold flex-grow">{player.name}</div>
                            {player.isHost ? (
                              <span className="text-xs bg-brand-secondary px-2 py-1 rounded text-white font-bold">HOST</span>
                            ) : player.id.startsWith('bot_') ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">BOT</span>
                                {isHost && (
                                  <button
                                    onClick={() => socket.removePlayer(player.id)}
                                    className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 hover:bg-rose-950/40 rounded transition-colors"
                                    title="Remove Bot"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ) : null}
                        </div>
                    ))}
                    {room.players.length === 1 && !isHost && (
                        <div className="text-center text-slate-500 py-4 italic">
                            Connecting to lobby...
                        </div>
                    )}
                </div>

                {isHost && (
                    <div className="mt-6 pt-4 border-t border-slate-700 space-y-3">
                        {room.players.length < 8 && (
                          <button
                            type="button"
                            onClick={() => socket.addBot()}
                            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-sm font-semibold border border-slate-700 flex items-center justify-center gap-2 transition-colors"
                          >
                            <span>+ Add Bot Player 🤖</span>
                          </button>
                        )}
                        <Button 
                            variant="primary" 
                            fullWidth 
                            className="text-lg py-4 shadow-xl shadow-brand-primary/20"
                            onClick={() => socket.startGame()}
                        >
                            START GAME 🎮
                        </Button>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};