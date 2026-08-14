import React from 'react';
import { Room } from '../types';
import { Button } from '../components/Button';
import { socket } from '../services/mockSocket';
import { soundService } from '../services/soundService';
import confetti from 'canvas-confetti';

interface GameOverProps {
    room: Room;
}

export const GameOver: React.FC<GameOverProps> = ({ room }) => {
    React.useEffect(() => {
        soundService.play('gameOver');
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    }, []);

    const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4">
            <h1 className="text-6xl font-display text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-8 filter drop-shadow-lg">
                GAME OVER
            </h1>

            <div className="relative mb-12 transform hover:scale-105 transition-transform duration-500">
                <div className="absolute inset-0 bg-yellow-500 blur-3xl opacity-20 rounded-full"></div>
                <div className="text-9xl relative z-10 animate-bounce-small">{winner.avatar}</div>
                <div className="absolute -top-6 -right-6 text-6xl rotate-12">👑</div>
            </div>

            <h2 className="text-3xl font-bold mb-2">{winner.name} Wins!</h2>
            <p className="text-slate-400 mb-8 text-xl">Score: <span className="text-white font-mono">{winner.score}</span></p>

            <div className="bg-brand-surface border border-slate-700 rounded-3xl p-6 w-full max-w-md mb-8">
                {sortedPlayers.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0">
                        <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-slate-400 text-black' : i === 2 ? 'bg-orange-700 text-white' : 'text-slate-500'}`}>
                                {i + 1}
                            </div>
                            <span className="text-lg">{p.avatar} {p.name}</span>
                        </div>
                        <span className="font-bold text-brand-primary font-mono text-lg">{p.score}</span>
                    </div>
                ))}
            </div>

            <Button onClick={() => socket.reset()} className="px-12 py-4 text-xl">
                Back to Home 🏠
            </Button>
        </div>
    );
};