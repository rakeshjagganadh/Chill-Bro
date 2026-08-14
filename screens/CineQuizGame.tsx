import React, { useEffect, useState, useRef } from 'react';
import { Player, Room, QuizQuestion } from '../types';
import { Button } from '../components/Button';
import { socket } from '../services/mockSocket';
import { generateQuizQuestion } from '../services/geminiService';
import { soundService } from '../services/soundService';
import confetti from 'canvas-confetti';

interface CineQuizGameProps {
  room: Room;
  currentPlayerId: string;
}

export const CineQuizGame: React.FC<CineQuizGameProps> = ({ room, currentPlayerId }) => {
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(room.settings.timerSeconds);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [roundEnded, setRoundEnded] = useState(false);
  const [roundHistory, setRoundHistory] = useState<string[]>([]);
  
  const timerRef = useRef<number | null>(null);
  const isHost = room.players.find(p => p.id === currentPlayerId)?.isHost;

  // Fetch Question on Round Start
  useEffect(() => {
    const fetchQuestion = async () => {
      setLoading(true);
      setRoundEnded(false);
      setSelectedOption(null);
      setTimeLeft(room.settings.timerSeconds);
      
      const q = await generateQuizQuestion(room.settings.category!, roundHistory);
      if (q) {
        setQuestion(q);
        setRoundHistory(prev => [...prev, q.plot]);
        setLoading(false);
        soundService.play('start'); // Play sound when round actually starts
      } else {
        // Simple fallback if API fails
        setQuestion({
            plot: "API Error: Could not generate question.",
            options: ["Error", "Error", "Error", "Error", "Error", "Error"],
            correctIndex: 0
        });
        setLoading(false);
      }
    };

    fetchQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.currentRound]);

  // Timer Logic
  useEffect(() => {
    if (!loading && !roundEnded && timeLeft > 0) {
      if (timeLeft <= 5) soundService.play('tick'); // Tick sound for last 5 seconds
      timerRef.current = window.setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && !roundEnded) {
      handleRoundEnd();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, loading, roundEnded]);

  const handleAnswer = (index: number) => {
    if (roundEnded || selectedOption !== null) return;
    
    // Play sound based on preliminary local check (server validates in real app, but instant feedback here)
    if (question && index === question.correctIndex) {
        soundService.play('success');
    } else {
        soundService.play('error');
    }

    setSelectedOption(index);
  };

  const handleRoundEnd = () => {
    setRoundEnded(true);
    
    // Calculate Score
    if (selectedOption === question?.correctIndex) {
      // Base 100 + speed bonus
      const bonus = Math.floor((timeLeft / room.settings.timerSeconds) * 50);
      socket.updateScore(currentPlayerId, 100 + bonus);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }

    // Simulate bots answering
    if (isHost) {
        room.players.forEach(p => {
            if (p.id !== currentPlayerId && !p.id.startsWith('bot')) return;
            if (p.id.startsWith('bot')) {
                // Bots have 50% chance of being right
                if (Math.random() > 0.5) {
                    socket.updateScore(p.id, 100);
                }
            }
        });
    }
  };

  const handleNextRound = () => {
      socket.nextRound();
  };

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh]">
              <div className="text-6xl animate-bounce mb-4">🎬</div>
              <h2 className="text-2xl font-display text-white mb-2">Director is thinking...</h2>
              <p className="text-slate-400">Generating a unique plot with AI</p>
          </div>
      );
  }

  if (roundEnded) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
            <div className="bg-brand-surface border border-slate-700 rounded-3xl p-8 mb-8">
                <h2 className="text-3xl font-display mb-2">Round {room.currentRound} Over!</h2>
                <div className="my-6">
                    <p className="text-slate-400 mb-2">The movie was:</p>
                    <div className="text-3xl font-bold text-brand-secondary">{question?.options[question.correctIndex]}</div>
                </div>
                
                <div className="p-4 bg-brand-dark rounded-xl mb-6">
                    <p className="text-lg italic text-slate-300">"{question?.plot}"</p>
                </div>

                {selectedOption === question?.correctIndex ? (
                    <div className="text-green-400 font-bold text-xl animate-pulse">Correct! +Points</div>
                ) : (
                    <div className="text-rose-400 font-bold text-xl">
                        {selectedOption === null ? "Time's Up!" : "Wrong Answer!"}
                    </div>
                )}
            </div>

            <div className="bg-brand-surface border border-slate-700 rounded-3xl p-6 mb-8">
                 <h3 className="text-xl font-bold mb-4">Leaderboard</h3>
                 {room.players.sort((a,b) => b.score - a.score).map((p, i) => (
                     <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                         <div className="flex items-center gap-3">
                             <span className="text-slate-500 font-mono w-6">#{i+1}</span>
                             <span>{p.avatar} {p.name}</span>
                         </div>
                         <span className="font-bold text-brand-primary">{p.score}</span>
                     </div>
                 ))}
            </div>

            {isHost && (
                <Button onClick={handleNextRound} fullWidth>
                    {room.currentRound >= room.maxRounds ? 'Finish Game' : 'Next Round →'}
                </Button>
            )}
            {!isHost && <p className="animate-pulse text-slate-400">Waiting for host...</p>}
        </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 h-full flex flex-col">
       {/* Header */}
       <div className="flex justify-between items-center mb-8">
           <div className="bg-brand-surface px-4 py-2 rounded-lg border border-slate-700">
               Round <span className="text-brand-primary font-bold">{room.currentRound}</span>/{room.maxRounds}
           </div>
           <div className={`bg-brand-surface px-6 py-3 rounded-xl border border-slate-700 text-2xl font-mono font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-brand-accent'}`}>
               {timeLeft}s
           </div>
       </div>

       {/* Question Area */}
       <div className="bg-gradient-to-br from-brand-surface to-brand-dark border border-slate-700 rounded-3xl p-8 mb-8 shadow-2xl min-h-[200px] flex items-center justify-center text-center">
           <h2 className="text-2xl md:text-3xl font-medium leading-relaxed">
               "{question?.plot}"
           </h2>
       </div>

       {/* Options Grid */}
       <div className="grid md:grid-cols-2 gap-4">
           {question?.options.map((opt, idx) => (
               <button
                 key={idx}
                 onClick={() => handleAnswer(idx)}
                 disabled={selectedOption !== null}
                 className={`
                    p-6 rounded-xl text-lg font-bold transition-all duration-200 text-left relative overflow-hidden group
                    ${selectedOption === idx 
                        ? 'bg-brand-primary text-white scale-95 ring-4 ring-brand-primary/30' 
                        : 'bg-brand-surface hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-brand-primary'}
                 `}
               >
                   <span className="opacity-50 mr-3 font-mono text-sm group-hover:text-brand-primary">{String.fromCharCode(65 + idx)}.</span>
                   {opt}
               </button>
           ))}
       </div>
    </div>
  );
};